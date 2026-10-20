"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { consumeDriveRedirect } from "@/lib/drive-browser";

/** After Google redirects back, keep the token in this tab and return to the edit page. */
export function GoogleDriveAuthReturn() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void consumeDriveRedirect().then((result) => {
      if (cancelled || !result) return;
      if (!result.ok) {
        toast.error(result.error);
      }
      if (result.returnPath && result.returnPath !== window.location.pathname) {
        router.push(result.returnPath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, toast]);

  return null;
}
