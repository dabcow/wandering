"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Plus, Rabbit, Trash2, Undo2 } from "lucide-react";
import type { Cell as CellData } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";

export type CellHandlers = {
  onText: (id: string, text: string) => void;
  onHeading: (id: string, heading: string) => void;
  onRabbitHole: (id: string) => void;
  onUndo: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddBelow: (id: string) => void;
  onDelete: (id: string) => void;
};

type Props = CellHandlers & {
  cell: CellData;
  index: number;
  /** True while this cell's rabbit hole is open. */
  active: boolean;
};

export function Cell({ cell, index, active, ...on }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: cell.id });
  const n = index + 1;

  return (
    <li
      ref={setNodeRef}
      className={`cell${isDragging ? " is-dragging" : ""}${active ? " is-active" : ""}`}
      style={{
        // Cells only move vertically.
        transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
        transition,
      }}
    >
      <div className="cell-gutter">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="cell-grip"
          aria-label={`Reorder cell ${n}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span className="gutter" aria-hidden>
          [{n}]
        </span>
      </div>

      <div className="cell-main">
        <div className="cell-top">
          <input
            className="cell-heading"
            value={cell.heading}
            placeholder="untitled"
            aria-label={`Cell ${n} label`}
            onChange={(event) => on.onHeading(cell.id, event.target.value)}
          />
          <div className="cell-tools">
            <button
              type="button"
              className="btn btn-rabbit"
              onClick={() => on.onRabbitHole(cell.id)}
              disabled={!cell.text.trim()}
              title={cell.text.trim() ? undefined : "Write something first"}
            >
              <Rabbit size={15} aria-hidden /> Rabbit hole
            </button>
            {cell.history.length > 0 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Undo last swap in cell ${n}`}
                title="Undo last swap"
                onClick={() => on.onUndo(cell.id)}
              >
                <Undo2 size={15} aria-hidden />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Duplicate cell ${n}`}
              title="Duplicate"
              onClick={() => on.onDuplicate(cell.id)}
            >
              <Copy size={15} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Add a cell below cell ${n}`}
              title="Add cell below"
              onClick={() => on.onAddBelow(cell.id)}
            >
              <Plus size={15} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              aria-label={`Delete cell ${n}`}
              title="Delete"
              onClick={() => on.onDelete(cell.id)}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>
        <AutoTextarea
          className="cell-text prose"
          value={cell.text}
          placeholder="Write this paragraph…"
          aria-label={`Cell ${n} text`}
          onChange={(event) => on.onText(cell.id, event.target.value)}
        />
      </div>
    </li>
  );
}
