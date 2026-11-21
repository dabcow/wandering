"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastState = { id: number; message: string; kind: "ok" | "error" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === "error" ? 5000 : 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
