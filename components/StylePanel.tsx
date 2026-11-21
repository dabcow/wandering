"use client";

import { RotateCcw } from "lucide-react";
import { describeAttribute } from "@/lib/ai/prompts";
import { clampValue } from "@/lib/attributes";
import { countWords, describeLength, targetSections } from "@/lib/length";
import type { Attribute } from "@/lib/types";
import { Pentagon } from "./Pentagon";

type Props = {
  attributes: Attribute[];
  length: number;
  /** The idea from step 1; the length is measured against it. */
  idea: string;
  onChange: (id: string, value: number) => void;
  onLength: (length: number) => void;
  onReset: () => void;
};

/** The pentagon, exact numeric controls, and the outline length. */
export function StylePanel({ attributes, length, idea, onChange, onLength, onReset }: Props) {
  const words = countWords(idea);
  const sections = targetSections(idea, length);

  return (
    <div className="style-grid">
      <div className="style-column">
        <div className="panel style-shape">
          <Pentagon attributes={attributes} onChange={onChange} />
        </div>

        <div className="panel length-panel">
          <div className="attr-row">
            <label htmlFor="length">Length</label>
            <output className="length-out" htmlFor="length">
              {sections} section{sections === 1 ? "" : "s"}
            </output>
          </div>
          <input
            id="length"
            className="attr-range"
            type="range"
            min={0}
            max={100}
            value={length}
            aria-valuetext={`${sections} sections, ${describeLength(length)}`}
            onChange={(event) => onLength(Number(event.target.value))}
          />
          <div className="length-scale" aria-hidden>
            <span>tighter</span>
            <span>in step</span>
            <span>expanded</span>
          </div>
          <p className="attr-directive">
            Outline {describeLength(length)}. Measured against your {words}-word idea.
          </p>
        </div>
      </div>

      <div className="panel style-values">
        <div className="panel-head">
          <span className="label">values</span>
          <button type="button" className="btn btn-quiet" onClick={onReset}>
            <RotateCcw size={13} aria-hidden /> Reset
          </button>
        </div>
        <ul className="attr-list">
          {attributes.map((a) => (
            <li key={a.id} className="attr">
              <div className="attr-row">
                <label htmlFor={`attr-${a.id}`}>{a.label}</label>
                <input
                  id={`attr-${a.id}`}
                  className="attr-number"
                  type="number"
                  min={0}
                  max={100}
                  value={a.value}
                  onChange={(event) => onChange(a.id, clampValue(Number(event.target.value)))}
                />
              </div>
              <input
                className="attr-range"
                type="range"
                min={0}
                max={100}
                value={a.value}
                aria-label={`${a.label} slider`}
                onChange={(event) => onChange(a.id, Number(event.target.value))}
              />
              <p className="attr-directive">{describeAttribute(a)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
