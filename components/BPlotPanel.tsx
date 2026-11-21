"use client";

import { Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Req } from "@/lib/useStoryAI";
import { AutoTextarea } from "./AutoTextarea";

type Props = {
  /** The saved premise, or null if the B plot has not been started. */
  premise: string | null;
  premiseReq: Req;
  /** Ask the AI for a premise; resolves to null on failure. */
  onSuggest: () => Promise<string | null>;
  onStart: (premise: string) => void;
  onChangePremise: (premise: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Start the subplot from a premise, or edit / remove one that exists. */
export function BPlotPanel(props: Props) {
  const started = props.premise !== null;
  const [draft, setDraft] = useState("");
  const value = started ? (props.premise ?? "") : draft;
  const setValue = started ? props.onChangePremise : setDraft;

  const suggest = async () => {
    const premise = await props.onSuggest();
    if (premise) setValue(premise);
  };

  return (
    <section className="bplot panel" aria-label="B plot">
      <div className="inspector-head">
        <h2>♠ Subplot</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className="hint">
        A second storyline that runs alongside the main plot, in its own lane of the map. You build it the
        same way, beat by beat, and its suggestions take the main plot into account.
      </p>
      <label className="field">
        <span className="label">Premise</span>
        <AutoTextarea
          value={value}
          maxLength={2000}
          placeholder="Who does it follow, what do they want, and what is in the way?"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {props.premiseReq.status === "error" && (
        <p className="hint hint-error" role="alert">
          {props.premiseReq.error}
        </p>
      )}
      <div className="inspector-actions">
        <button
          type="button"
          className="btn"
          disabled={props.premiseReq.status === "loading"}
          onClick={suggest}
        >
          <Sparkles size={14} aria-hidden />{" "}
          {props.premiseReq.status === "loading" ? "Thinking…" : "Suggest a premise"}
        </button>
        {started ? (
          <button type="button" className="btn btn-danger" onClick={props.onRemove}>
            <Trash2 size={14} aria-hidden /> Remove subplot
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft.trim()}
            onClick={() => props.onStart(draft.trim())}
          >
            Start the subplot
          </button>
        )}
      </div>
    </section>
  );
}
