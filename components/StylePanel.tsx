"use client";

import { RotateCcw } from "lucide-react";
import { describeAttribute } from "@/lib/ai/prompts";
import { clampValue } from "@/lib/attributes";
import type { Attribute } from "@/lib/types";
import { Pentagon } from "./Pentagon";

type Props = {
  attributes: Attribute[];
  onChange: (id: string, value: number) => void;
  onReset: () => void;
};

/** The pentagon plus exact numeric controls and a readout of what the values mean. */
export function StylePanel({ attributes, onChange, onReset }: Props) {
  return (
    <div className="style-grid">
      <div className="panel style-shape">
        <Pentagon attributes={attributes} onChange={onChange} />
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
