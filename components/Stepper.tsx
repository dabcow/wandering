"use client";

import { STEPS, type Step } from "@/lib/types";

type Props = {
  current: Step;
  canVisit: (step: Step) => boolean;
  onVisit: (step: Step) => void;
};

export function Stepper({ current, canVisit, onVisit }: Props) {
  return (
    <nav className="stepper" aria-label="Steps">
      <ol>
        {STEPS.map((step, index) => (
          <li key={step}>
            <button
              type="button"
              className="step"
              aria-current={step === current ? "step" : undefined}
              disabled={step !== current && !canVisit(step)}
              onClick={() => onVisit(step)}
            >
              <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
              {step}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
