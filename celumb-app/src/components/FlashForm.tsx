"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { useToast } from "@/components/Toast";

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  pendingLabel?: string;
};

function isNextControlFlowError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = String((e as { digest?: string }).digest || "");
  if (digest.startsWith("NEXT_")) return true;
  // Next.js redirect/notFound sometimes only expose message
  const msg = e instanceof Error ? e.message : "";
  return msg === "NEXT_REDIRECT" || msg === "NEXT_NOT_FOUND";
}

export function FlashForm({
  action,
  children,
  className,
  successMessage = "Guardado correctamente.",
  pendingLabel = "Guardando…",
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();
  const lastHandled = useRef<ActionResult | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        const result = await action(formData);
        return result ?? { ok: false as const, error: "Sin respuesta del servidor." };
      } catch (e) {
        if (isNextControlFlowError(e)) throw e;
        const msg =
          e instanceof Error
            ? e.message
            : "No se pudo guardar. Intenta de nuevo.";
        return { ok: false as const, error: msg || "Error desconocido." };
      }
    },
    null as ActionResult | null,
  );

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      toast.success(state.message || successMessage);
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(state.error || "Revisa los datos e intenta de nuevo.");
    }
  }, [state, successMessage, toast, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      noValidate
      data-pending={pending ? "true" : "false"}
      onSubmit={() => {
        // Clear prior result marker so a repeat submit always notifies
        lastHandled.current = null;
      }}
    >
      <fieldset disabled={pending} className="flash-fieldset">
        {children}
      </fieldset>
      <div className="form-status" aria-live="polite">
        {pending && <span className="muted">{pendingLabel}</span>}
        {!pending && state?.ok && (
          <span className="ok">{successMessage}</span>
        )}
        {!pending && state && !state.ok && (
          <span className="err">{state.error}</span>
        )}
      </div>
    </form>
  );
}
