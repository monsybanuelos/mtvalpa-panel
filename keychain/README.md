# Llavero Raitzac multicolor + NFC

Un `.3mf` con **3 objetos** para Elegoo Slicer:

| Objeto | Color | Qué es |
|--------|-------|--------|
| `blanco_fondo` | Blanco | Mitad trasera con **hueco cuadrado NFC** |
| `blanco_frente` | Blanco | Mitad frontal + anillo + agujero anilla |
| `naranja_texto` | Naranja | Solo el script **Rait Valpa - Zac** |

## Montaje

1. Imprime `blanco_fondo` (blanco).
2. Imprime juntos `blanco_frente` + `naranja_texto` (blanco + naranja).
3. Coloca el chip NFC en el hueco cuadrado del fondo.
4. Pega el frente sobre el fondo (alineando el agujero de la anilla).

## Hueco NFC

| Medida | Valor |
|--------|-------|
| Forma | Cuadrado |
| Lado interior | **22 × 22 mm** |
| Profundidad | **1.2 mm** |
| Piso bajo el chip | 0.8 mm |

Sirve para tags ~20 mm (o stickers más pequeños). Si tu chip es más grande/grueso, cambia `NFC_SQUARE` / `NFC_DEPTH` en `generate_keychain.py` y regenera.

## Archivos

- [`raitzac_llavero.3mf`](./raitzac_llavero.3mf) — **usar este**
- STLs sueltos: `raitzac_blanco_fondo.stl`, `raitzac_blanco_frente.stl`, `raitzac_naranja_texto.stl`

Las dos mitades salen **una al lado de la otra** en la cama (listas para imprimir).

## En Elegoo Slicer

1. Abre `raitzac_llavero.3mf`
2. Asigna filamento blanco a `blanco_fondo` y `blanco_frente`
3. Asigna naranja a `naranja_texto`
4. (Opcional) imprime el fondo en otra placa si quieres

## Regenerar

```bash
pip install pillow numpy opencv-python-headless trimesh shapely manifold3d mapbox-earcut
python keychain/generate_keychain.py
```
