#!/usr/bin/env python3
"""Generate a multicolor NFC keychain 3MF from the Raitzac logo.

Three objects for Elegoo / Orca-style slicers:
  - blanco_fondo: back half with square NFC pocket (print white)
  - blanco_frente: front half + outer ring + keyring hole (print white)
  - naranja_texto: script "Rait Valpa - Zac" only (print orange)

Assembly: place NFC chip in the square pocket → glue frente onto fondo.

Removes MB, EST 2025, and side arcs.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import Polygon
from shapely.ops import orient, unary_union
from trimesh.creation import extrude_polygon

HERE = Path(__file__).resolve().parent
ASSET = HERE / "source_logo.jpg"
ALT_ASSET = Path(
    "/home/ubuntu/.cursor/projects/workspace/assets/"
    "01a1337c-64d8-70d8-b938-30282e0e9f5d.jpg"
)

# Overall keychain at 80% of the original 45 mm design; NFC pocket stays absolute.
DIAMETER_MM = 36.0  # 45 * 0.8
# Back half (holds the chip)
FONDO_H = 2.2  # slightly thicker so floor under pocket stays ~0.8 mm
NFC_SQUARE = 24.0  # unchanged — chip fit
NFC_DEPTH = 1.4  # unchanged — chip fit
# Front half
FRENTE_H = 1.5
RELIEF_H = 1.0
TEXT_SINK = 0.2
# Male square on the front that nests into the NFC pocket on the back
BOSS_CLEARANCE = 0.35  # mm per side so it slides in without binding
BOSS_SIDE = NFC_SQUARE - 2.0 * BOSS_CLEARANCE  # ~23.3 mm
BOSS_H = 0.7  # leaves room for the chip in the 1.4 mm pocket
HOLE_D = 4.0  # keep standard keyring hole
# Place hole near the rim with a little wall left outside
HOLE_OFFSET = DIAMETER_MM / 2.0 - HOLE_D / 2.0 - 1.2  # ~14.8 mm
# Lay parts side-by-side on the build plate
PART_GAP_X = 42.0
UPSCALE = 3
SRC_OUTER_R = 171.5


def load_source() -> Image.Image:
    path = ASSET if ASSET.exists() else ALT_ASSET
    return Image.open(path).convert("RGB")


def _upscale_mask(mask_bool: np.ndarray, max_r_px: float) -> np.ndarray:
    img = Image.fromarray((mask_bool.astype(np.uint8) * 255))
    img = img.resize(
        (mask_bool.shape[1] * UPSCALE, mask_bool.shape[0] * UPSCALE),
        Image.Resampling.NEAREST,
    )
    img = img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    mask = np.array(img)
    mh, mw = mask.shape
    mcy, mcx = (mh - 1) / 2.0, (mw - 1) / 2.0
    myy, mxx = np.mgrid[0:mh, 0:mw]
    mrr = np.sqrt((mxx - mcx) ** 2 + (myy - mcy) ** 2)
    mask[mrr > max_r_px] = 0
    return mask


def build_masks(src: Image.Image) -> tuple[np.ndarray, np.ndarray, Image.Image]:
    """Return (ring_mask_hi, text_mask_hi, cleaned_preview)."""
    arr = np.array(src).astype(np.float32)
    h, w = arr.shape[:2]
    cy, cx = (h - 1) / 2.0, (w - 1) / 2.0
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    ang = np.degrees(np.arctan2(cy - yy, xx - cx))

    dark = (r < 100) & (g < 100) & (b < 130)
    ring = dark & (rr >= 157) & (rr <= 174)

    brown = (
        (r > 110)
        & (g > 70)
        & (b < 150)
        & (r > g + 5)
        & (g >= b - 15)
        & (rr < 145)
    )
    brown_img = Image.fromarray((brown * 255).astype(np.uint8)).filter(
        ImageFilter.MaxFilter(3)
    )
    brown_d = np.array(brown_img) > 0
    nonwhite = (r < 245) | (g < 245) | (b < 245)
    text_zone = rr < 135
    exclude_mb = (ang > 70) & (ang < 110) & (rr > 115)
    exclude_est = (ang > -130) & (ang < -50) & (rr > 115)
    text_color = (
        ((r > 90) & (g > 50) & (b < 170) & (r > b + 15) & (r + g > 180)) | brown
    )
    text = (
        brown_d
        & text_zone
        & nonwhite
        & (~exclude_mb)
        & (~exclude_est)
        & text_color
    )
    text = text | (brown & (~exclude_mb) & (~exclude_est))

    cleaned = np.ones_like(arr) * 255
    cleaned[ring] = [230, 230, 230]
    cleaned[text] = [230, 110, 30]
    disc = rr <= SRC_OUTER_R
    bg = disc & (~ring) & (~text)
    cleaned[bg] = [250, 250, 250]
    cleaned_img = Image.fromarray(cleaned.astype(np.uint8))

    ring_hi = _upscale_mask(ring, max_r_px=522)
    text_hi = _upscale_mask(text, max_r_px=135 * UPSCALE + 10)
    return ring_hi, text_hi, cleaned_img


def contours_to_polygons(mask: np.ndarray) -> list[Polygon]:
    mh, mw = mask.shape
    mcy, mcx = (mh - 1) / 2.0, (mw - 1) / 2.0
    outer_r_px = SRC_OUTER_R * UPSCALE
    px_to_mm = (DIAMETER_MM / 2.0) / outer_r_px

    bin_mask = (mask > 127).astype(np.uint8) * 255
    contours, hierarchy = cv2.findContours(
        bin_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )
    hierarchy = hierarchy[0] if hierarchy is not None else None

    def contour_to_ring(cnt, simplify=0.4):
        pts = cnt.squeeze(1)
        if pts.ndim != 2 or len(pts) < 3:
            return None
        x = (pts[:, 0] - mcx) * px_to_mm
        y = (mcy - pts[:, 1]) * px_to_mm
        coords = list(zip(x.tolist(), y.tolist()))
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        try:
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty or poly.area < 0.05:
                return None
            poly = poly.simplify(simplify * px_to_mm, preserve_topology=True)
            if poly.is_empty or poly.area < 0.05:
                return None
            return poly
        except Exception:
            return None

    polys: list[Polygon] = []
    if hierarchy is None:
        for cnt in contours:
            p = contour_to_ring(cnt)
            if p is not None:
                polys.append(p)
    else:
        parsed = [contour_to_ring(c) for c in contours]
        for i, p in enumerate(parsed):
            if p is None or hierarchy[i][3] != -1:
                continue
            holes = []
            child = hierarchy[i][2]
            while child != -1:
                hp = parsed[child]
                if hp is not None and hp.exterior is not None:
                    holes.append(list(hp.exterior.coords))
                child = hierarchy[child][0]
            try:
                poly = Polygon(list(p.exterior.coords), holes=holes)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if isinstance(poly, Polygon) and poly.area >= 0.05:
                    polys.append(poly)
                elif hasattr(poly, "geoms"):
                    for g in poly.geoms:
                        if g.area >= 0.05:
                            polys.append(g)
            except Exception:
                polys.append(p)

    if not polys:
        return []
    merged = unary_union(polys)
    if merged.geom_type == "Polygon":
        return [merged]
    if merged.geom_type == "MultiPolygon":
        return list(merged.geoms)
    return [g for g in getattr(merged, "geoms", []) if g.geom_type == "Polygon"]


def extrude_polys(polys: list[Polygon], height: float, z0: float) -> trimesh.Trimesh:
    parts = []
    for poly in polys:
        if poly.area < 0.05:
            continue
        poly = orient(poly, sign=1.0)
        mesh = extrude_polygon(poly, height=height)
        mesh.apply_translation([0, 0, z0])
        parts.append(mesh)
    if not parts:
        raise RuntimeError("No geometry to extrude")
    return trimesh.util.concatenate(parts)


def disc(height: float) -> trimesh.Trimesh:
    m = trimesh.creation.cylinder(
        radius=DIAMETER_MM / 2.0, height=height, sections=128
    )
    m.apply_translation([0, 0, height / 2.0])
    return m


def keyring_hole(height: float) -> trimesh.Trimesh:
    hole = trimesh.creation.cylinder(
        radius=HOLE_D / 2.0, height=height + 4.0, sections=48
    )
    hole.apply_translation([0, HOLE_OFFSET, height / 2.0])
    return hole


def nfc_pocket_cutter() -> trimesh.Trimesh:
    """Square cutter slightly taller than the pocket so the boolean is clean."""
    over = 0.4
    sz = NFC_DEPTH + over
    box = trimesh.creation.box(extents=[NFC_SQUARE, NFC_SQUARE, sz])
    # Bottom of cutter at pocket floor (FONDO_H - NFC_DEPTH); top above fondo.
    z_center = (FONDO_H - NFC_DEPTH) + sz / 2.0
    box.apply_translation([0, 0, z_center])
    return box


def finalize(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh.merge_vertices()
    mesh.fix_normals()
    return mesh


def build_blanco_fondo() -> trimesh.Trimesh:
    body = disc(FONDO_H)
    cut = trimesh.boolean.difference(
        [body, nfc_pocket_cutter()], engine="manifold"
    )
    cut = trimesh.boolean.difference(
        [cut, keyring_hole(FONDO_H)], engine="manifold"
    )
    return finalize(cut)


def nesting_boss() -> trimesh.Trimesh:
    """Square peg that seats into the NFC pocket for alignment."""
    boss = trimesh.creation.box(extents=[BOSS_SIDE, BOSS_SIDE, BOSS_H])
    boss.apply_translation([0, 0, BOSS_H / 2.0])
    return boss


def build_blanco_frente(ring_polys: list[Polygon]) -> trimesh.Trimesh:
    # Boss on the bed (z=0..BOSS_H) nests into fondo pocket when assembled.
    boss = nesting_boss()
    plate = disc(FRENTE_H)
    plate.apply_translation([0, 0, BOSS_H])
    ring = extrude_polys(ring_polys, height=RELIEF_H, z0=BOSS_H + FRENTE_H)
    combined = trimesh.boolean.union([boss, plate, ring], engine="manifold")
    total_h = BOSS_H + FRENTE_H + RELIEF_H
    combined = trimesh.boolean.difference(
        [combined, keyring_hole(total_h)], engine="manifold"
    )
    return finalize(combined)


def build_naranja(text_polys: list[Polygon]) -> trimesh.Trimesh:
    height = RELIEF_H + TEXT_SINK
    z0 = BOSS_H + FRENTE_H - TEXT_SINK
    text = extrude_polys(text_polys, height=height, z0=z0)
    return finalize(text)


def save_preview(
    fondo: trimesh.Trimesh,
    frente: trimesh.Trimesh,
    naranja: trimesh.Trimesh,
    path: Path,
) -> None:
    """Top view of both halves (fondo left with square pocket, frente right)."""
    size_w, size_h = 900, 480
    img = Image.new("RGB", (size_w, size_h), (245, 242, 235))
    draw = ImageDraw.Draw(img)

    def draw_part(mesh, ox, oy, scale, colors_by_z):
        v = mesh.vertices
        faces = mesh.faces
        fc_z = v[faces, 2].mean(axis=1)
        order = np.argsort(fc_z)
        for fi in order:
            z = fc_z[fi]
            col = colors_by_z[-1][1]
            for zmin, c in colors_by_z:
                if z >= zmin:
                    col = c
            tri = []
            for j in faces[fi]:
                sx = int(ox + v[j, 0] * scale)
                sy = int(oy - v[j, 1] * scale)
                tri.append((sx, sy))
            draw.polygon(tri, fill=col)

    scale = 7.5
    # Fondo (left) — show pocket as darker square
    cx_f, cy_f = 220, 240
    R = DIAMETER_MM / 2.0
    draw.ellipse(
        [
            cx_f - R * scale,
            cy_f - R * scale,
            cx_f + R * scale,
            cy_f + R * scale,
        ],
        fill=(235, 235, 235),
        outline=(180, 180, 180),
    )
    half = NFC_SQUARE / 2 * scale
    draw.rectangle(
        [cx_f - half, cy_f - half, cx_f + half, cy_f + half],
        fill=(210, 210, 210),
        outline=(140, 140, 140),
    )
    hr = HOLE_D / 2 * scale
    draw.ellipse(
        [
            cx_f - hr,
            cy_f - HOLE_OFFSET * scale - hr,
            cx_f + hr,
            cy_f - HOLE_OFFSET * scale + hr,
        ],
        fill=(245, 242, 235),
    )
    draw.text((cx_f - 70, 20), "blanco_fondo (hueco NFC)", fill=(80, 80, 80))

    # Frente (right)
    cx_r, cy_r = 680, 240
    draw.ellipse(
        [
            cx_r - R * scale,
            cy_r - R * scale,
            cx_r + R * scale,
            cy_r + R * scale,
        ],
        fill=(245, 245, 245),
        outline=(180, 180, 180),
    )
    # shift meshes to local for painting relief
    frente_local = frente.copy()
    frente_local.apply_translation([-PART_GAP_X, 0, 0])
    naranja_local = naranja.copy()
    naranja_local.apply_translation([-PART_GAP_X, 0, 0])

    def paint_xy(mesh, color, z_min, cx, cy):
        v = mesh.vertices
        faces = mesh.faces
        fc_z = v[faces, 2].mean(axis=1)
        for fi in np.where(fc_z > z_min)[0]:
            tri = [
                (int(cx + v[j, 0] * scale), int(cy - v[j, 1] * scale))
                for j in faces[fi]
            ]
            draw.polygon(tri, fill=color)

    # Nesting boss outline (mates into NFC pocket)
    half_boss = BOSS_SIDE / 2 * scale
    draw.rectangle(
        [cx_r - half_boss, cy_r - half_boss, cx_r + half_boss, cy_r + half_boss],
        outline=(120, 120, 120),
        width=2,
    )
    paint_xy(
        frente_local,
        (210, 210, 210),
        z_min=BOSS_H + FRENTE_H + 0.2,
        cx=cx_r,
        cy=cy_r,
    )
    paint_xy(
        naranja_local,
        (230, 110, 30),
        z_min=BOSS_H + FRENTE_H,
        cx=cx_r,
        cy=cy_r,
    )
    draw.ellipse(
        [
            cx_r - hr,
            cy_r - HOLE_OFFSET * scale - hr,
            cx_r + hr,
            cy_r - HOLE_OFFSET * scale + hr,
        ],
        fill=(245, 242, 235),
    )
    draw.text((cx_r - 90, 20), "blanco_frente + naranja_texto", fill=(80, 80, 80))
    draw.text(
        (40, size_h - 36),
        f"Hueco {NFC_SQUARE:.0f}x{NFC_SQUARE:.0f}x{NFC_DEPTH:.1f}  |  "
        f"resalte {BOSS_SIDE:.1f}x{BOSS_SIDE:.1f}x{BOSS_H:.1f} empotra en base",
        fill=(90, 90, 90),
    )
    img.save(path)


def main() -> None:
    src = load_source()
    ring_mask, text_mask, cleaned = build_masks(src)
    cleaned.save(HERE / "cleaned_logo.png")
    Image.fromarray(ring_mask).save(HERE / "mask_anillo.png")
    Image.fromarray(text_mask).save(HERE / "mask_texto.png")
    Image.fromarray(np.maximum(ring_mask, text_mask)).save(HERE / "relief_mask.png")

    ring_polys = contours_to_polygons(ring_mask)
    text_polys = contours_to_polygons(text_mask)
    print(f"ring polys={len(ring_polys)} text polys={len(text_polys)}")
    print(
        f"NFC pocket {NFC_SQUARE}x{NFC_SQUARE}x{NFC_DEPTH} mm "
        f"(floor {FONDO_H - NFC_DEPTH:.1f} mm)"
    )

    fondo = build_blanco_fondo()
    frente = build_blanco_frente(ring_polys)
    naranja = build_naranja(text_polys)

    # Place frente + texto to the right for a print-ready plate layout
    frente.apply_translation([PART_GAP_X, 0, 0])
    naranja.apply_translation([PART_GAP_X, 0, 0])

    fondo.export(HERE / "raitzac_blanco_fondo.stl")
    frente.export(HERE / "raitzac_blanco_frente.stl")
    naranja.export(HERE / "raitzac_naranja_texto.stl")

    scene = trimesh.Scene(
        {
            "blanco_fondo": fondo,
            "blanco_frente": frente,
            "naranja_texto": naranja,
        }
    )
    out_3mf = HERE / "raitzac_llavero.3mf"
    scene.export(out_3mf)

    mono = trimesh.util.concatenate([fondo, frente, naranja])
    mono.export(HERE / "raitzac_llavero.stl")

    save_preview(fondo, frente, naranja, HERE / "preview_top.png")

    # Also write a small assembly diagram note into cleaned preview folder
    loaded = trimesh.load(out_3mf)
    names = list(loaded.geometry.keys()) if isinstance(loaded, trimesh.Scene) else ["?"]
    for name, g in loaded.geometry.items():
        print(
            f"  {name}: vol={g.volume:.1f} z=[{g.bounds[0,2]:.2f},{g.bounds[1,2]:.2f}] "
            f"watertight={g.is_watertight}"
        )
    print(f"OK 3MF objects={names}")

    # Remove obsolete single-piece white STL if present
    old = HERE / "raitzac_blanco_base.stl"
    if old.exists():
        old.unlink()


if __name__ == "__main__":
    main()
