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
4. Encaja el **cuadrado del frente** en el hueco de la base y pega (alinea también el agujero de la anilla).

El frente lleva un resalte cuadrado (~23.3 × 23.3 × 0.7 mm) que empotra en el hueco NFC, con holgura para el chip.

## Tamaño

| Medida | Valor |
|--------|-------|
| Diámetro llavero | **~36 mm** (80 % del original de 45 mm) |
| Grosor fondo / frente | 2.2 mm / 1.5 mm (+1 mm relieve) |
| Agujero anilla | Ø 4 mm |

## Hueco NFC (sin reducir)

| Medida | Valor |
|--------|-------|
| Forma | Cuadrado |
| Lado interior | **24 × 24 mm** |
| Profundidad | **1.4 mm** |
| Piso bajo el chip | 0.8 mm |

Sirve para tags ~22 mm. Si aún queda justo, sube `NFC_SQUARE` / `NFC_DEPTH` en `generate_keychain.py` y regenera.

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
