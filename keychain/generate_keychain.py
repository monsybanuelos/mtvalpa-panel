#!/usr/bin/env python3
"""Generate a printable keychain 3MF from the Raitzac logo.

Removes MB, EST 2025, and side arcs; keeps the outer ring + script text.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import trimesh
from PIL import Image, ImageFilter
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
HOLE_D = 4.0
HOLE_OFFSET = 18.5


def load_source() -> Image.Image:
    path = ASSET if ASSET.exists() else ALT_ASSET
    return Image.open(path).convert("RGB")


def build_relief_mask(src: Image.Image) -> tuple[np.ndarray, Image.Image]:
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
    relief = ring | text

    cleaned = np.ones_like(arr) * 255
    cleaned[ring] = [20, 30, 70]
    cleaned[text] = [180, 120, 70]
    cleaned_img = Image.fromarray(cleaned.astype(np.uint8))

    mask_img = Image.fromarray((relief * 255).astype(np.uint8))
    mask_img = mask_img.resize((1500, 1500), Image.Resampling.NEAREST)
    mask_img = mask_img.filter(ImageFilter.MaxFilter(5)).filter(
        ImageFilter.MinFilter(3)
    )
    mask = np.array(mask_img)
    mh, mw = mask.shape
    mcy, mcx = (mh - 1) / 2.0, (mw - 1) / 2.0
    myy, mxx = np.mgrid[0:mh, 0:mw]
    mrr = np.sqrt((mxx - mcx) ** 2 + (myy - mcy) ** 2)
    mask[mrr > 522] = 0
    return mask, cleaned_img


def contours_to_polygons(mask: np.ndarray) -> list[Polygon]:
    mh, mw = mask.shape
    mcy, mcx = (mh - 1) / 2.0, (mw - 1) / 2.0
    outer_r_px = 171.5 * 3
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

    merged = unary_union(polys)
    if merged.geom_type == "Polygon":
        return [merged]
    if merged.geom_type == "MultiPolygon":
        return list(merged.geoms)
    return [g for g in getattr(merged, "geoms", []) if g.geom_type == "Polygon"]


def build_mesh(polys: list[Polygon]) -> trimesh.Trimesh:
    relief_meshes = []
    for poly in polys:
        if poly.area < 0.05:
            continue
        poly = orient(poly, sign=1.0)
        mesh = extrude_polygon(poly, height=RELIEF_H)
        mesh.apply_translation([0, 0, BASE_H])
        relief_meshes.append(mesh)
    if not relief_meshes:
        raise RuntimeError("No relief geometry generated")

    relief = trimesh.util.concatenate(relief_meshes)
    base = trimesh.creation.cylinder(
        radius=DIAMETER_MM / 2.0, height=BASE_H, sections=128
    )
    base.apply_translation([0, 0, BASE_H / 2.0])

    combined = trimesh.boolean.union([base, relief], engine="manifold")
    hole = trimesh.creation.cylinder(
        radius=HOLE_D / 2.0, height=BASE_H + RELIEF_H + 4, sections=48
    )
    hole.apply_translation([0, HOLE_OFFSET, (BASE_H + RELIEF_H) / 2.0])
    final = trimesh.boolean.difference([combined, hole], engine="manifold")
    final.merge_vertices()
    final.fix_normals()
    return final


def main() -> None:
    src = load_source()
    mask, cleaned = build_relief_mask(src)
    cleaned.save(HERE / "cleaned_logo.png")
    Image.fromarray(mask).save(HERE / "relief_mask.png")

    polys = contours_to_polygons(mask)
    mesh = build_mesh(polys)
    mesh.export(HERE / "raitzac_llavero.stl")
    mesh.export(HERE / "raitzac_llavero.3mf")
    print(
        f"OK extents={mesh.extents} volume={mesh.volume:.1f} "
        f"watertight={mesh.is_watertight}"
    )


if __name__ == "__main__":
    main()
