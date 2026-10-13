# Planilla de bandejas — Llavero Raitzac (Centauri 2)

**Bandeja impresora:** 256 × 256 mm  
**Llavero:** Ø ~36 mm · paso 39.7 mm · margen 6 mm  
**Capacidad:** 6 × 6 = **36 unidades** por bandeja

## Bandeja 1 — solo bases (1 color)

| Campo | Valor |
|-------|-------|
| Archivo | [`bandeja1_bases_36uds.3mf`](./bandeja1_bases_36uds.3mf) |
| Piezas | 36 × `base_01` … `base_36` |
| Color | Blanco (u otro, un solo filamento) |
| Contenido | Disco con hueco NFC 24×24×1.4 mm |

## Bandeja 2 — solo tapas + letras (2 colores)

| Campo | Valor |
|-------|-------|
| Archivo | [`bandeja2_tapas_letras_36uds.3mf`](./bandeja2_tapas_letras_36uds.3mf) |
| Piezas blancas | 36 × `tapa_01` … `tapa_36` |
| Piezas naranjas | 36 × `texto_01` … `texto_36` |
| Asignación | Todas las `tapa_*` → filamento blanco; todas las `texto_*` → naranja |

## Orden de impresión

1. Imprimir **Bandeja 1** (bases).
2. Nuevo proyecto → 2 filamentos → Volúmenes de limpieza → Aceptar → abrir **Bandeja 2**.
3. Montaje: chip en base → pegar tapa.

## Layout (números en la placa)

```
 6 columnas × 6 filas, centrado en la bandeja
 Paso entre centros: 39.7 mm
```
