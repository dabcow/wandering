"use client";

import { PenLine, Plus } from "lucide-react";
import { useState } from "react";
import { AutoTextarea } from "./AutoTextarea";

export type OwnPlotPoint = { title: string; summary: string; isEnding: boolean };

/** The always-present "write your own" slot among a plot point's next steps. */
export function OwnCard({ disabled, onAdd }: { disabled: boolean; onAdd: (value: OwnPlotPoint) => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const ready = title.trim().length > 0 && !disabled;

  const add = () => {
    if (!ready) return;
    onAdd({ title: title.trim(), summary: summary.trim(), isEnding });
    setTitle("");
    setSummary("");
    setIsEnding(false);
  };

  return (
    <form
      className="option option-own"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <span className="option-own-head">
        <PenLine size={13} aria-hidden /> Write your own
      </span>
      <input
        className="own-title"
        value={title}
        placeholder="What happens?"
        aria-label="Your plot point, in a few words"
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
      />
      <AutoTextarea
        className="own-summary"
        value={summary}
        placeholder="A sentence or two more (optional)"
        aria-label="More detail about your plot point"
        maxLength={700}
        onChange={(event) => setSummary(event.target.value)}
      />
      <div className="own-foot">
        <label className="check">
          <input type="checkbox" checked={isEnding} onChange={(event) => setIsEnding(event.target.checked)} />
          Ends the story
        </label>
        <button type="submit" className="btn" disabled={!ready}>
          <Plus size={14} aria-hidden /> Add
        </button>
      </div>
    </form>
  );
}
