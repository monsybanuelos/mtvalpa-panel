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

- [`raitzac_llavero_completo.3mf`](./raitzac_llavero_completo.3mf) — **3MF completo** (3 objetos: fondo + frente + texto)
- [`raitzac_llavero.3mf`](./raitzac_llavero.3mf) — mismo archivo (nombre corto)
- STLs sueltos: `raitzac_blanco_fondo.stl`, `raitzac_blanco_frente.stl`, `raitzac_naranja_texto.stl`
- Piezas sueltas (Elegoo): carpeta [`single_parts/`](./single_parts/)

## Bandejas Centauri 2 (12 uds — solo filas 1 y 2)

Sin fila superior; **esquina superior derecha libre** para la torre de purga.

| Bandeja | Archivo | Contenido |
|---------|---------|-----------|
| 1 | [`bandejas/bandeja1_bases_12uds.3mf`](./bandejas/bandeja1_bases_12uds.3mf) | **12** bases con hueco NFC · **1 color** |
| 2 | [`bandejas/bandeja2_tapas_letras_12uds.3mf`](./bandejas/bandeja2_tapas_letras_12uds.3mf) | **12** tapas + letras naranja · **2 colores** |

Planilla: [`bandejas/PLANILLA.md`](./bandejas/PLANILLA.md) · [`bandejas/planilla_bandejas.csv`](./bandejas/planilla_bandejas.csv)

Las dos mitades sueltas salen **una al lado de la otra** en la cama (archivo completo unitario).

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
