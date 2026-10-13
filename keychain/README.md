# Llavero Raitzac multicolor (3MF)

Dos objetos en un solo `.3mf` para asignar filamento en **Elegoo Slicer** (u Orca/Bambu):

| Objeto en el slicer | Color sugerido | Contenido |
|---------------------|----------------|-----------|
| `blanco_base` | Blanco | Disco + anillo + agujero anilla |
| `naranja_texto` | Naranja | Solo el script **Rait Valpa - Zac** |

Sin **MB**, sin **EST 2025**, sin líneas laterales.

## Archivo principal

- [`raitzac_llavero.3mf`](./raitzac_llavero.3mf) — **usar este** (2 objetos)
- [`raitzac_blanco_base.stl`](./raitzac_blanco_base.stl) / [`raitzac_naranja_texto.stl`](./raitzac_naranja_texto.stl) — por si importas piezas sueltas

## En Elegoo Slicer

1. Abre `raitzac_llavero.3mf`
2. En la lista de objetos deberías ver `blanco_base` y `naranja_texto`
3. Asigna extrusor/filamento blanco al primero y naranja al segundo
4. Imprime juntos (misma posición; el texto encaja sobre la base)

## Medidas

| Parámetro | Valor |
|-----------|-------|
| Diámetro | ~45 mm |
| Base | 2 mm |
| Relieve | +1 mm |
| Agujero anilla | Ø 4 mm |

## Regenerar

```bash
pip install pillow numpy opencv-python-headless trimesh shapely manifold3d mapbox-earcut
python keychain/generate_keychain.py
```

## Impresión sugerida

- Base plana en la cama
- Capa 0.16–0.20 mm
- Sin soportes
- Flush / purga según tu setup multicolor
