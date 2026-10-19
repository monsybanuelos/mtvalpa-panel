import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  type Role,
  type SessionUser,
} from "./auth-edge";

export type { Role, SessionUser };
export { SESSION_COOKIE };

const USERS: { username: string; password: string; role: Role }[] = [
  { username: "Admin", password: "087962", role: "admin" },
  { username: "Ventas", password: "0879", role: "ventas" },
];

const SECRET = process.env.CELUMB_AUTH_SECRET || "celumb-local-demo-secret";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function encodeSession(user: SessionUser): string {
  const body = Buffer.from(
    JSON.stringify({
      u: user.username,
      r: user.role,
      exp: Date.now() + MAX_AGE_SEC * 1000,
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string | undefined): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      u: string;
      r: Role;
      exp: number;
    };
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.r !== "admin" && data.r !== "ventas") return null;
    if (!USERS.some((u) => u.username === data.u && u.role === data.r)) {
      return null;
    }
    return { username: data.u, role: data.r };
  } catch {
    return null;
  }
}

export function verifyCredentials(
  username: string,
  password: string,
): SessionUser | null {
  const u = USERS.find(
    (x) =>
      x.username.toLowerCase() === username.trim().toLowerCase() &&
      x.password === password,
  );
  if (!u) return null;
  return { username: u.username, role: u.role };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function setSession(user: SessionUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function canAcquire(role: Role): boolean {
  return role === "admin";
}

export function canManageSupplierCredit(role: Role): boolean {
  return role === "admin";
}

export function roleLabel(role: Role): string {
  return role === "admin" ? "Admin" : "Ventas";
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("Debes iniciar sesión.");
  return s;
}

/** Admin pages. Ventas is sent to stock before any finance query runs. */
export async function requireAdminPage(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/inventario");
  return session;
}
