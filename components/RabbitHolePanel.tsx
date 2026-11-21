"use client";

import { Check, RotateCw } from "lucide-react";
import type { Cell } from "@/lib/types";
import { Dialog } from "./Dialog";
import { ErrorNotice, Loading } from "./Status";

export type RabbitState = {
  status: "idle" | "loading" | "error";
  alternatives: string[];
  error?: string;
};

type Props = {
  /** The cell being explored, or null when the panel is closed. */
  cell: Cell | null;
  cellNumber: number;
  state: RabbitState;
  onClose: () => void;
  onPick: (text: string) => void;
  onMore: () => void;
  onRestore: (historyIndex: number) => void;
};

export function RabbitHolePanel({ cell, cellNumber, state, onClose, onPick, onMore, onRestore }: Props) {
  return (
    <Dialog
      open={cell !== null}
      onClose={onClose}
      variant="drawer"
      title={cell ? `Rabbit hole · cell ${cellNumber}` : "Rabbit hole"}
    >
      {cell && (
        <div className="rabbit">
          <section>
            <h3 className="label">current</h3>
            <p className="rabbit-current prose">{cell.text}</p>
          </section>

          <section>
            <div className="panel-head">
              <h3 className="label">alternatives</h3>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={onMore}
                disabled={state.status === "loading"}
              >
                <RotateCw size={13} aria-hidden /> More alternatives
              </button>
            </div>

            {state.status === "loading" && <Loading label="Exploring other ways to say this…" lines={6} />}
            {state.status === "error" && (
              <ErrorNotice message={state.error ?? "Could not load alternatives."} onRetry={onMore} />
            )}
            {state.status === "idle" && (
              <ul className="alt-list">
                {state.alternatives.map((text, index) => {
                  const inUse = text === cell.text;
                  return (
                    <li key={`${index}-${text.slice(0, 24)}`} className={`alt${inUse ? " is-used" : ""}`}>
                      <p className="prose">{text}</p>
                      <div className="alt-foot">
                        <span className="gutter">alt {index + 1}</span>
                        {inUse ? (
                          <span className="alt-used">
                            <Check size={13} aria-hidden /> In the cell
                          </span>
                        ) : (
                          <button type="button" className="btn btn-primary" onClick={() => onPick(text)}>
                            Use this
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {cell.history.length > 0 && (
            <section>
              <h3 className="label">earlier versions</h3>
              <ul className="alt-list">
                {cell.history
                  .map((text, index) => ({ text, index }))
                  .reverse()
                  .map(({ text, index }) => (
                    <li key={`${index}-${text.slice(0, 24)}`} className="alt alt-history">
                      <p className="prose">{text}</p>
                      <div className="alt-foot">
                        <span className="gutter">v{index + 1}</span>
                        <button type="button" className="btn" onClick={() => onRestore(index)}>
                          Restore
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
