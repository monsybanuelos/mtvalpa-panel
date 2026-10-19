"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/lib/auth-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      return loginAction(_prev, formData);
    },
    null as ActionResult | null,
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark__glyph" aria-hidden>
            ◈
          </span>
          <div>
            <p className="login-brand__name">CeluMB</p>
            <p className="login-brand__sub">MB Celulares</p>
          </div>
        </div>
        <h1 className="login-title">Iniciar sesión</h1>
        <p className="login-lede">
          Acceso local para el equipo. Usa tu perfil Admin o Ventas.
        </p>
        <form action={formAction} className="login-form">
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              placeholder="Admin o Ventas"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary login-submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </button>
          <div className="form-status" aria-live="polite">
            {state && !state.ok && <span className="err">{state.error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
