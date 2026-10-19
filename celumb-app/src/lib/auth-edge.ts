/** Edge-safe session peek (middleware). Full verify happens in server getSession. */

export type Role = "admin" | "ventas";

export type SessionUser = {
  username: string;
  role: Role;
};

export const SESSION_COOKIE = "celumb_session";

function decodeBase64Url(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function peekSessionCookie(
  cookieHeader: string | null,
): SessionUser | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const data = JSON.parse(decodeBase64Url(body)) as {
      u?: string;
      r?: string;
      exp?: number;
    };
    if (!data.u || (data.r !== "admin" && data.r !== "ventas")) return null;
    if (data.exp && data.exp < Date.now()) return null;
    return { username: data.u, role: data.r as Role };
  } catch {
    return null;
  }
}
