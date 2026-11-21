"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState, type Dispatch } from "react";
import { blankCell, newId, type Action } from "@/lib/project";
import type { Cell as CellData } from "@/lib/types";
import { Cell, type CellHandlers } from "./Cell";

type Props = {
  cells: CellData[];
  dispatch: Dispatch<Action>;
};

/** The writing board: the outline as a stack of reorderable cells. */
export function CellList({ cells, dispatch }: Props) {
  // Only one rabbit hole is open at a time.
  const [holeId, setHoleId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Jump rather than glide when a move needs the page to scroll; a smooth
      // scroll that gets cut short leaves the cell where it started.
      scrollBehavior: "auto",
    }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      dispatch({ type: "moveCell", activeId: String(active.id), overId: String(over.id) });
    }
  };

  const addAlternate = (cellId: string) => {
    const alternate = { id: newId(), text: "" };
    dispatch({ type: "addAlternate", cellId, alternate });
    setFocusTarget(alternate.id);
  };

  const handlers: CellHandlers = {
    onStart: (id) => {
      dispatch({ type: "updateCell", id, patch: { started: true } });
      setFocusTarget(id);
    },
    onPatch: (id, patch) => dispatch({ type: "updateCell", id, patch }),
    onToggleHole: (id) => {
      // Closing a hole (this one, or the one it replaces) drops versions left empty.
      if (holeId) dispatch({ type: "pruneAlternates", cellId: holeId });
      if (holeId === id) {
        setHoleId(null);
        return;
      }
      setHoleId(id);
      // A hole always opens onto a blank version, ready to write in.
      const blank = cells.find((c) => c.id === id)?.alternates.find((a) => !a.text.trim());
      if (blank) setFocusTarget(blank.id);
      else addAlternate(id);
    },
    onAddAlternate: addAlternate,
    onAlternateText: (cellId, alternateId, text) =>
      dispatch({ type: "updateAlternate", cellId, alternateId, text }),
    onSwapAlternate: (cellId, alternateId) => dispatch({ type: "swapAlternate", cellId, alternateId }),
    onDeleteAlternate: (cellId, alternateId) =>
      dispatch({ type: "deleteAlternate", cellId, alternateId }),
    onDuplicate: (id) => {
      const cell = cells.find((c) => c.id === id);
      if (!cell) return;
      dispatch({
        type: "insertCell",
        afterId: id,
        cell: {
          ...cell,
          id: newId(),
          alternates: cell.alternates.map((a) => ({ ...a, id: newId() })),
        },
      });
    },
    onAddBelow: (id) => {
      const cell = blankCell();
      dispatch({ type: "insertCell", afterId: id, cell });
      setFocusTarget(cell.id);
    },
    onDelete: (id) => {
      const cell = cells.find((c) => c.id === id);
      const hasWriting = cell?.text.trim() || cell?.alternates.some((a) => a.text.trim());
      if (hasWriting && !window.confirm("Delete this cell and what you wrote in it?")) return;
      if (holeId === id) setHoleId(null);
      dispatch({ type: "deleteCell", id });
    },
  };

  return (
    <DndContext
      id="cells"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={cells.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ol className="cell-list">
          {cells.map((cell, index) => (
            <Cell
              key={cell.id}
              cell={cell}
              index={index}
              holeOpen={cell.id === holeId}
              focusTarget={focusTarget}
              on={handlers}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
