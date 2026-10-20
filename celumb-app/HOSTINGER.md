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

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Client ID público de Google (Web). Sin client secret. Sirve para **Subir a Drive** en Editar celular. Si falta, el botón dice que Drive no está configurado.
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

## Subir fotos a Google Drive

El archivo sale del iPhone directo a Drive. No pasa por Hostinger (el CDN responde 429 si el POST de la foto entra al servidor).

En [Google Cloud Console](https://console.cloud.google.com/):

1. Crea o elige un proyecto.
2. **APIs y servicios → Biblioteca** → habilita **Google Drive API**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**.
   - Tipo de usuario: Externo (o Interno si es Google Workspace).
   - Nombre de la app y correo de asistencia.
   - Alcance: solo `https://www.googleapis.com/auth/drive.file` (ver, editar, crear y borrar únicamente los archivos que esta app abre en Drive).
   - Mientras la app esté en **Prueba**, agrega el Gmail de la tienda en **Usuarios de prueba**. Si no, Google no deja entrar.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - Orígenes de JavaScript autorizados: `https://celumb.mtvalpa.com`
   - URI de redireccionamiento autorizados: `https://celumb.mtvalpa.com`
5. Copia solo el **ID de cliente** (termina en `.apps.googleusercontent.com`). No copies ni pegues el client secret en el repo, en el navegador ni en este archivo.

En hPanel → Web App → Environment variables:

| Nombre | Valor |
|--------|--------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | el ID de cliente del paso 5 |

Reinicia el Web App después de pegarla. El botón **Subir a Drive** está en Inventario → Editar, junto a Link de Foto 1 y Link de Foto 2. La primera vez abre el inicio de sesión de Google en la misma pestaña (Safari del iPhone). Luego guarda el link de compartir con el mismo guardado que **Guardar cambios**.

## Qué pedir a Jonax si algo falta

- Crear la Web App Node y subir este ZIP (o conectar GitHub).
- Pegar las variables de arriba (valores desde Supabase Dashboard → Settings → API / Database).
- Node **20**.
- Si quiere `mtvalpa.com/celumb`: en hPanel, dominio/proxy hacia la Web App (sin SSH hace falta el mapeo de dominio del panel).

## No incluir en el ZIP

- `node_modules/`, `.next/`, `.env`, `.env.local`, `*.db`, secrets del Project store.
