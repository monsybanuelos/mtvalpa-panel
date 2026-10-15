# Tablero Valpa · Zacatecas

Micrositio para arrastrar 5 unidades entre **Valpa** y **Zacatecas**. Quien abra la URL ve la última configuración guardada en el servidor.

Unidades: 02 Avanza, 03 Avanza, 05 Avanza, 06 Urvan, 07 Hiace.

## Cómo correrlo

```bash
cd tablero
node server.js
```

Abre [http://localhost:3847](http://localhost:3847). Puerto: `PORT` (por defecto 3847).

## Persistencia

`GET` / `PUT` `/api/state` guarda un JSON en `tablero/data/state.json` (asignación de zona + marcas de tiempo). La interfaz actualiza al soltar o al pulsar «A Valpa / A Zacatecas» (optimista). Si dos personas mueven a la vez, gana la última escritura. Cada 4 s se vuelve a leer el servidor.

Por defecto las 5 unidades empiezan en Valpa.

Fechas en español, zona `America/Mexico_City`.
