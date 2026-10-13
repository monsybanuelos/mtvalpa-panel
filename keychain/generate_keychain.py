#!/usr/bin/env python3
"""Generate a multicolor keychain 3MF from the Raitzac logo.

Two objects for Elegoo / Orca-style slicers:
  - blanco_base: disc + outer ring + keyring hole (print white)
  - naranja_texto: script "Rait Valpa - Zac" only (print orange)

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

DIAMETER_MM = 45.0
BASE_H = 2.0
RELIEF_H = 1.0
# Sink text slightly into the base so both colors bond when printed together
TEXT_SINK = 0.2
HOLE_D = 4.0
HOLE_OFFSET = 18.5
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
    # show disc area lightly
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


def make_hole_cutter() -> trimesh.Trimesh:
    hole = trimesh.creation.cylinder(
        radius=HOLE_D / 2.0, height=BASE_H + RELIEF_H + 4, sections=48
    )
    hole.apply_translation([0, HOLE_OFFSET, (BASE_H + RELIEF_H) / 2.0])
    return hole


def build_blanco(ring_polys: list[Polygon]) -> trimesh.Trimesh:
    base = trimesh.creation.cylinder(
        radius=DIAMETER_MM / 2.0, height=BASE_H, sections=128
    )
    base.apply_translation([0, 0, BASE_H / 2.0])
    ring = extrude_polys(ring_polys, height=RELIEF_H, z0=BASE_H)
    combined = trimesh.boolean.union([base, ring], engine="manifold")
    final = trimesh.boolean.difference([combined, make_hole_cutter()], engine="manifold")
    final.merge_vertices()
    final.fix_normals()
    return final


def build_naranja(text_polys: list[Polygon]) -> trimesh.Trimesh:
    # Height includes sink so top sits at BASE_H + RELIEF_H
    height = RELIEF_H + TEXT_SINK
    z0 = BASE_H - TEXT_SINK
    text = extrude_polys(text_polys, height=height, z0=z0)
    text.merge_vertices()
    text.fix_normals()
    return text


def save_preview(blanco: trimesh.Trimesh, naranja: trimesh.Trimesh, path: Path) -> None:
    size = 600
    img = Image.new("RGB", (size, size), (245, 242, 235))
    draw = ImageDraw.Draw(img)
    all_v = np.vstack([blanco.vertices, naranja.vertices])
    xmin, ymin = all_v[:, 0].min(), all_v[:, 1].min()
    xmax, ymax = all_v[:, 0].max(), all_v[:, 1].max()
    span = max(xmax - xmin, ymax - ymin) * 1.08

    def to_px(x, y):
        sx = int((x - xmin + (span - (xmax - xmin)) / 2) / span * (size - 1))
        sy = int((1 - (y - ymin + (span - (ymax - ymin)) / 2) / span) * (size - 1))
        return sx, sy

    R = DIAMETER_MM / 2.0
    x0, y0 = to_px(-R, R)
    x1, y1 = to_px(R, -R)
    draw.ellipse(
        [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=(245, 245, 245)
    )

    def paint(mesh: trimesh.Trimesh, color: tuple[int, int, int], z_min: float) -> None:
        faces = mesh.faces
        v = mesh.vertices
        fc_z = v[faces, 2].mean(axis=1)
        for fi in np.where(fc_z > z_min)[0]:
            tri = [to_px(v[j, 0], v[j, 1]) for j in faces[fi]]
            draw.polygon(tri, fill=color)

    paint(blanco, (235, 235, 235), z_min=2.2)
    # base face already drawn; ring is light gray outline via relief verts
    paint(blanco, (210, 210, 210), z_min=2.2)
    paint(naranja, (230, 110, 30), z_min=BASE_H)

    hr = HOLE_D / 2.0
    hy = HOLE_OFFSET
    x0, y0 = to_px(-hr, hy + hr)
    x1, y1 = to_px(hr, hy - hr)
    draw.ellipse(
        [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=(245, 242, 235)
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

    blanco = build_blanco(ring_polys)
    naranja = build_naranja(text_polys)

    # Separate STLs for import-as-parts workflows
    blanco.export(HERE / "raitzac_blanco_base.stl")
    naranja.export(HERE / "raitzac_naranja_texto.stl")

    # Multi-object 3MF for Elegoo Slicer (assign filament per object)
    scene = trimesh.Scene(
        {
            "blanco_base": blanco,
            "naranja_texto": naranja,
        }
    )
    out_3mf = HERE / "raitzac_llavero.3mf"
    scene.export(out_3mf)

    # Combined single-mesh STL kept for quick mono preview / backup
    mono = trimesh.util.concatenate([blanco, naranja])
    mono.export(HERE / "raitzac_llavero.stl")

    save_preview(blanco, naranja, HERE / "preview_top.png")

    loaded = trimesh.load(out_3mf)
    names = list(loaded.geometry.keys()) if isinstance(loaded, trimesh.Scene) else ["?"]
    print(
        f"OK 3MF objects={names} "
        f"blanco_vol={blanco.volume:.1f} naranja_vol={naranja.volume:.1f} "
        f"extents={mono.extents}"
    )


if __name__ == "__main__":
    main()
