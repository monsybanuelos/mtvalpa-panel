/** Browser-only Google Drive upload. The file never goes through this app's server. */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const TOKEN_KEY = "celumb.google.drive.token";
const DB_NAME = "celumb-drive";
const STORE = "pending";
const PENDING_KEY = "job";

export type DriveSlot = 1 | 2;

type SavedToken = { accessToken: string; expiresAt: number };

export type PendingDriveUpload = {
  slot: DriveSlot;
  stockNo: string;
  returnPath: string;
  state: string;
  fileName: string;
  mime: string;
  file: Blob;
};

const MAX_BYTES = 25 * 1024 * 1024;

export function driveRedirectUri(): string {
  return window.location.origin;
}

export function isAllowedDrivePhoto(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/heic" ||
    type === "image/heif"
  ) {
    return true;
  }
  return /\.(jpe?g|png|heic|heif)$/i.test(file.name);
}

export function drivePhotoMime(file: { type?: string; name?: string }): string {
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  if (type === "image/png" || /\.png$/i.test(name)) return "image/png";
  if (type === "image/heic" || /\.heic$/i.test(name)) return "image/heic";
  if (type === "image/heif" || /\.heif$/i.test(name)) return "image/heif";
  return "image/jpeg";
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return "jpg";
}

export function driveFileName(stockNo: string, slot: DriveSlot, mime: string): string {
  const stock = stockNo.replace(/[^A-Za-z0-9_-]/g, "") || "foto";
  return `${stock}-foto${slot}.${extForMime(mime)}`;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function editPath(stockNo: string): string {
  return `/inventario/editar/${encodeURIComponent(stockNo)}`;
}

export function readDriveToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedToken;
    if (!saved.accessToken || saved.expiresAt <= Date.now()) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return saved.accessToken;
  } catch {
    return null;
  }
}

function saveDriveToken(accessToken: string, expiresInSec: number) {
  const expiresAt = Date.now() + Math.max(30, expiresInSec - 60) * 1000;
  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ accessToken, expiresAt } satisfies SavedToken),
  );
}

export function clearDriveToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB"));
  });
}

function idbSet(value: PendingDriveUpload | undefined): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        if (value) store.put(value, PENDING_KEY);
        else store.delete(PENDING_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB"));
      }),
  );
}

export function readPendingDriveUpload(): Promise<PendingDriveUpload | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(PENDING_KEY);
        req.onsuccess = () => resolve((req.result as PendingDriveUpload) || null);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB"));
      }),
  );
}

export function clearPendingDriveUpload(): Promise<void> {
  return idbSet(undefined).catch(() => undefined);
}

/** Send the shop Google account through a full-page redirect. Popups fail in iPhone Safari. */
export async function beginDriveSignIn(input: {
  clientId: string;
  stockNo: string;
  slot: DriveSlot;
  file: File;
}): Promise<void> {
  if (input.file.size <= 0 || input.file.size > MAX_BYTES) {
    throw new Error("La foto es demasiado grande (máx. 25 MB).");
  }
  const mime = drivePhotoMime(input.file);
  const state = randomState();
  const pending: PendingDriveUpload = {
    slot: input.slot,
    stockNo: input.stockNo,
    returnPath: editPath(input.stockNo),
    state,
    fileName: driveFileName(input.stockNo, input.slot, mime),
    mime,
    file: input.file,
  };
  await idbSet(pending);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", driveRedirectUri());
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  window.location.assign(url.toString());
}

export type DriveReturn =
  | { ok: true; returnPath: string }
  | { ok: false; error: string; returnPath: string | null };

/** Read the token Google put in the URL fragment. It never reaches the server. */
export async function consumeDriveRedirect(): Promise<DriveReturn | null> {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.includes("access_token") && !hash.includes("error=")) return null;
  const params = new URLSearchParams(hash);
  const clean = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", clean);

  const pending = await readPendingDriveUpload().catch(() => null);
  const returnPath =
    pending && pending.returnPath.startsWith("/inventario/editar/")
      ? pending.returnPath
      : null;
  const error = params.get("error");
  if (error) {
    return {
      ok: false,
      error:
        error === "access_denied"
          ? "No se autorizó Drive."
          : "No se pudo entrar a Google.",
      returnPath,
    };
  }
  const accessToken = params.get("access_token") || "";
  const state = params.get("state") || "";
  const scope = params.get("scope") || "";
  const expiresIn = Number(params.get("expires_in") || "0");
  if (
    !accessToken ||
    !pending ||
    state !== pending.state ||
    !scope.includes(DRIVE_SCOPE)
  ) {
    return { ok: false, error: "No se pudo confirmar la sesión de Google.", returnPath };
  }
  saveDriveToken(accessToken, Number.isFinite(expiresIn) ? expiresIn : 3600);
  return { ok: true, returnPath: pending.returnPath };
}

function shareUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view?usp=sharing`;
}

function uploadBody(file: Blob, name: string, mime: string, boundary: string): Blob {
  const meta = JSON.stringify({ name, mimeType: mime });
  const head =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${meta}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  return new Blob([head, file, tail]);
}

function postFile(
  token: string,
  body: Blob,
  boundary: string,
  onProgress: (pct: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", `multipart/related; boundary=${boundary}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        clearDriveToken();
        reject(new Error("AUTH"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("No se pudo subir la foto a Drive."));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { id?: string };
        if (!data.id) throw new Error("missing id");
        resolve({ id: data.id });
      } catch {
        reject(new Error("No se pudo subir la foto a Drive."));
      }
    };
    xhr.onerror = () => reject(new Error("No se pudo subir la foto a Drive."));
    xhr.send(body);
  });
}

async function shareWithAnyone(token: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (res.status === 401) {
    clearDriveToken();
    throw new Error("AUTH");
  }
  if (!res.ok) throw new Error("No se pudo compartir el link de Drive.");
}

/** Upload one photo to the signed-in Drive and return a link anyone can open. */
export async function uploadPhotoToDrive(input: {
  token: string;
  file: Blob;
  fileName: string;
  mime: string;
  onProgress: (pct: number) => void;
}): Promise<string> {
  const boundary = `celumb${randomState()}`;
  const body = uploadBody(input.file, input.fileName, input.mime, boundary);
  input.onProgress(5);
  const created = await postFile(input.token, body, boundary, input.onProgress);
  input.onProgress(94);
  await shareWithAnyone(input.token, created.id);
  input.onProgress(100);
  return shareUrl(created.id);
}

const claimedStocks = new Set<string>();

/** One resume per stock, even if the edit page mounts twice. */
export async function claimPendingDriveUpload(
  stockNo: string,
): Promise<PendingDriveUpload | null> {
  if (claimedStocks.has(stockNo)) return null;
  const pending = await readPendingDriveUpload();
  if (!pending || pending.stockNo !== stockNo) return null;
  claimedStocks.add(stockNo);
  await clearPendingDriveUpload();
  return pending;
}
