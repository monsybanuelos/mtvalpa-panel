# Llavero Raitzac (3MF)

Modelo de llavero listo para imprimir a partir del logo, sin **MB**, sin **EST 2025** y sin las líneas laterales.

## Archivo principal

- [`raitzac_llavero.3mf`](./raitzac_llavero.3mf) — para slicers (Bambu, PrusaSlicer, Cura, etc.)
- [`raitzac_llavero.stl`](./raitzac_llavero.stl) — respaldo STL

## Medidas

| Parámetro | Valor |
|-----------|-------|
| Diámetro | ~45 mm |
| Base | 2 mm |
| Relieve (borde + texto) | +1 mm |
| Agujero anilla | Ø 4 mm |

## Contenido del relieve

- Anillo exterior
- Texto script **Rait Valpa - Zac**
- Agujero arriba para la anilla

## Regenerar

```bash
pip install pillow numpy opencv-python-headless trimesh shapely manifold3d mapbox-earcut
python keychain/generate_keychain.py
```

## Impresión sugerida

- Orientación: base plana en la cama
- Capa 0.16–0.20 mm
- Relleno 15–20 %
- Sin soportes
