"use client";

import { Hourglass } from "lucide-react";
import { describePacing } from "@/lib/ai/prompts";
import { depthForPacing } from "@/lib/tree";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Levels in the guide rail already generated, if any. */
  currentDepth: number;
};

export function PacingSlider({ value, onChange, currentDepth }: Props) {
  const depth = depthForPacing(value);
  const stale = currentDepth > 0 && currentDepth !== depth;

  return (
    <div className="panel pacing">
      <div className="pacing-row">
        <label htmlFor="pacing">
          <Hourglass size={15} aria-hidden /> Pacing
        </label>
        <output className="pacing-out" htmlFor="pacing">
          {depth} beats
        </output>
      </div>
      <input
        id="pacing"
        className="range"
        type="range"
        min={0}
        max={100}
        value={value}
        aria-valuetext={`${depth} beats, ${describePacing(value)}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="pacing-scale" aria-hidden>
        <span>slow burn</span>
        <span>fast</span>
      </div>
      <p className="hint">
        {depth} beats from start to end, {describePacing(value)}.
        {stale && ` Your current outline has ${currentDepth} beats; make a new outline to apply this.`}
      </p>
    </div>
  );
}
