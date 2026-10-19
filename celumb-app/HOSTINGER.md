# CeluMB → Hostinger Web Apps (Node.js / Next.js)

**Directorio raíz del Web App: `celumb-app`** (no `tablero`, no el HTML `celumb` de la raíz del repo).


App real (Next.js), **no** el HTML estático. Datos en **Supabase**.

## Requisitos

- Hostinger plan con **Web Apps / Node.js**
- **Node.js 20** (o 22). Ver `engines` en `package.json`: `>=20 <23`
- Repo/ZIP subido desde GitHub/GitLab o este ZIP

## Comandos en hPanel

| Campo | Valor |
|--------|--------|
| **Build** | `npm install && npm run build` |
| **Start** | `npm start` |
| **Puerto** | Hostinger inyecta `PORT` — `next start` lo respeta |

## Variables de entorno (solo nombres)

Pégalas en hPanel → Web App → Environment variables. **No** subas el archivo de secrets al ZIP.

### Obligatorias (Supabase cloud)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (o `SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`) — solo servidor
- `DATABASE_URL` — URI del **pooler** (Session/Transaction), no el host IPv6 directo `db.*.supabase.co`

### Recomendadas

- `CELUMB_AUTH_SECRET` — secreto HMAC de sesión (cámbialo en producción)
- `CELUMB_PUBLIC_URL` — p.ej. `https://celumb.mtvalpa.com` o la URL que Hostinger asigne
- `PORT` — lo suele poner Hostinger

### Opcionales

- `SUPABASE_PROJECT_REF`
- `SUPABASE_PASSWORD`
- `SUPABASE_DB_HOST` / `SUPABASE_DB_PORT` (si arman `DATABASE_URL` a mano)

Roles de la app (sin Supabase Auth aún): **Admin** / **087962**, **Ventas** / **0879**.

## Qué hace la app con esas env

Si `DATABASE_URL` o la service role están presentes, lecturas/escrituras van a **Postgres Supabase** (inventario, ventas, cobranza, ledger, accesorios). Las fotos de adquisición suben al bucket Storage `phone-photos`.

## Después del primer deploy

1. Confirmar que las env están pegadas (sin valores en chats/ZIP).
2. Abrir la URL de la Web App → login Admin → Inventario.
3. Probar un guardado: **Registrar adquisición** de un celular de prueba y recargar (debe seguir ahí).
4. Si Hostinger da una URL distinta de `mtvalpa.com/celumb`, apunta el dominio/proxy en hPanel o actualiza `CELUMB_PUBLIC_URL`.

## Qué pedir a Jonax si algo falta

- Crear la Web App Node y subir este ZIP (o conectar GitHub).
- Pegar las variables de arriba (valores desde Supabase Dashboard → Settings → API / Database).
- Node **20**.
- Si quiere `mtvalpa.com/celumb`: en hPanel, dominio/proxy hacia la Web App (sin SSH hace falta el mapeo de dominio del panel).

## No incluir en el ZIP

- `node_modules/`, `.next/`, `.env`, `.env.local`, `*.db`, secrets del Project store.
