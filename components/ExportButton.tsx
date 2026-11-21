"use client";

import { ClipboardCopy } from "lucide-react";
import { copyForDocs } from "@/lib/export";
import type { Cell } from "@/lib/types";

type Props = {
  title: string;
  cells: Cell[];
  onResult: (message: string, kind: "ok" | "error") => void;
};

export function ExportButton({ title, cells, onResult }: Props) {
  const empty = !cells.some((c) => c.text.trim());

  const copy = async () => {
    try {
      await copyForDocs(title, cells);
      onResult("Copied. Paste into Google Docs.", "ok");
    } catch {
      onResult("Couldn't reach the clipboard. Check the browser's permission and try again.", "error");
    }
  };

  return (
    <button type="button" className="btn btn-primary" onClick={copy} disabled={empty}>
      <ClipboardCopy size={15} aria-hidden /> Copy for Google Docs
    </button>
  );
}
