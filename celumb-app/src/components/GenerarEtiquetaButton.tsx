"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  generatePhoneLabel,
  preloadLabelLogo,
  type PhoneLabelInput,
} from "@/lib/phone-label";

export function GenerarEtiquetaButton({
  phone,
  className = "btn-link",
  readPhone,
}: {
  phone: PhoneLabelInput;
  className?: string;
  readPhone?: () => PhoneLabelInput;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    preloadLabelLogo();
  }, []);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await generatePhoneLabel(readPhone ? readPhone() : phone);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar la etiqueta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={busy}
    >
      Generar etiqueta
    </button>
  );
}
