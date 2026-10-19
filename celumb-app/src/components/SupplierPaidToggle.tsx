"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSupplierPaid } from "@/lib/actions";
import { useToast } from "@/components/Toast";

type Paid = "Si" | "No";

export function SupplierPaidToggle({
  id,
  paid,
  today,
}: {
  id: number;
  paid: Paid;
  today: string;
}) {
  const [value, setValue] = useState<Paid>(paid);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    setValue(paid);
  }, [paid]);

  return (
    <select
      className={`paid-select ${value === "Si" ? "paid-select--si" : "paid-select--no"}`}
      aria-label="Pagado"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next: Paid = e.target.value === "Si" ? "Si" : "No";
        const prev = value;
        if (next === prev) return;
        setValue(next);
        const fd = new FormData();
        fd.set("id", String(id));
        fd.set("paid", next);
        fd.set("paid_at", today);
        startTransition(async () => {
          const res = await setSupplierPaid(fd);
          if (res.ok) {
            toast.success(res.message || "Pagado actualizado.");
            router.refresh();
          } else {
            setValue(prev);
            toast.error(res.error || "No se pudo actualizar Pagado.");
          }
        });
      }}
    >
      <option value="No">No</option>
      <option value="Si">Si</option>
    </select>
  );
}
