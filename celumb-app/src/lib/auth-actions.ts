"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  setSession,
  verifyCredentials,
} from "./auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = verifyCredentials(username, password);
  if (!user) {
    return { ok: false, error: "Usuario o contraseña incorrectos." };
  }
  await setSession(user);
  redirect(user.role === "ventas" ? "/inventario" : "/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
