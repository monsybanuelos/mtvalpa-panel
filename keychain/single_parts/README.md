# Impresión en Elegoo (Centauri 2)

## Un color (ya te funciona)
- `llavero_un_color.3mf` o `blanco_fondo.3mf`

## Dos colores (frente blanco + texto naranja)

El error de *matriz de purga* aparece al cargar multimaterial mal. Hazlo **en este orden**:

1. **Archivo → Nuevo proyecto** (vacío, sin modelo).
2. En **Filamento**, deja **2** filamentos (ej. blanco = 1, naranja = 2).
3. Abre **Volúmenes de limpieza** → **Aceptar** (sin cargar el modelo todavía).
4. **Archivo → Importar** (o arrastra) `frente_dos_colores.3mf`.
5. En la lista de objetos:
   - `blanco_frente` → filamento 1 (blanco)
   - `naranja_texto` → filamento 2 (naranja)
6. **Laminar bandeja**.

El fondo NFC va aparte (un color):
- `blanco_fondo.3mf`

### Si el error vuelve
- No abras el `raitzac_llavero.3mf` completo a 2 colores.
- Usa solo `frente_dos_colores.3mf` con el orden de arriba.
- O imprime frente en blanco y el texto no (un color), si solo quieres validar.

## Archivos
| Archivo | Uso |
|---------|-----|
| `frente_dos_colores.3mf` | Frente + texto alineados (2 objetos) |
| `blanco_fondo.3mf` | Mitad NFC, 1 color |
| `llavero_un_color.3mf` | Todo junto 1 color |
