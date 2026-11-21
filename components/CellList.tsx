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
import type { Cell as CellData } from "@/lib/types";
import { Cell, type CellHandlers } from "./Cell";

type Props = CellHandlers & {
  cells: CellData[];
  activeCellId: string | null;
  onMove: (activeId: string, overId: string) => void;
};

export function CellList({ cells, activeCellId, onMove, ...handlers }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
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
              active={cell.id === activeCellId}
              {...handlers}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
