"use client";

import { Pencil } from "lucide-react";
import type { Project } from "@/lib/types";
import type { Req } from "@/lib/useStoryAI";

type Props = {
  idea: string;
  summary: Project["plotSummary"];
  req: Req;
  /** Go back to step 1 to change the idea. */
  onEdit: () => void;
};

/**
 * A reminder of the story's central idea at the top of the Tree step, with
 * the typos tidied by the AI. Until the tidy version is ready, or if it
 * can't be made, the idea shows as the writer typed it.
 */
export function PlotPanel({ idea, summary, req, onEdit }: Props) {
  const typed = idea.trim();
  if (!typed) return null;
  const tidy = summary && summary.from === typed ? summary.text : null;

  return (
    <section className="panel plot-panel" aria-labelledby="plot-title">
      <div className="plot-head">
        <h2 id="plot-title" className="label">
          <span className="pip" aria-hidden>
            ♥
          </span>
          Plot
        </h2>
        <button type="button" className="btn btn-quiet" onClick={onEdit}>
          <Pencil size={13} aria-hidden /> Edit idea
        </button>
      </div>
      <p className={`plot-text${tidy ? "" : " is-raw"}`}>{tidy ?? typed}</p>
      {!tidy && req.status === "loading" && (
        <p className="hint" role="status">
          <span className="spinner" aria-hidden /> Tidying the wording…
        </p>
      )}
    </section>
  );
}
