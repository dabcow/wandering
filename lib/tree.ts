/**
 * Pure helpers for the plot tree: traversal, layout, pacing, and where a
 * node's anchor belongs in the document. No runtime imports, so the tests run
 * on plain Node.
 */
import type { Plot, PlotNode } from "./types";

/* ---------- Tunable limits ---------- */

/** Suggestions requested for each parent. */
export const OPTIONS_PER_PARENT = 4;
/** How many children the writer may keep under one parent. */
export const MAX_CHOICES_PER_PARENT = 3;
/** How many nodes one level of one plot may hold. */
export const MAX_NODES_PER_LEVEL = 8;
/** Tree depth at the fastest and slowest pacing. */
export const MIN_DEPTH = 5;
export const MAX_DEPTH = 12;

/** Pacing 0 (slow burn) gives the deepest tree; 100 (fast) the shallowest. */
export function depthForPacing(pacing: number): number {
  const clamped = Math.max(0, Math.min(100, pacing));
  return Math.round(MAX_DEPTH - ((MAX_DEPTH - MIN_DEPTH) * clamped) / 100);
}

/* ---------- Traversal ---------- */

/** Key for the set of suggestions under one parent ("root" for level 1). */
export function groupKey(plot: Plot, parentId: string | null): string {
  return `${plot}:${parentId ?? "root"}`;
}

export function childrenOf(nodes: PlotNode[], plot: Plot, parentId: string | null): PlotNode[] {
  return nodes.filter((n) => n.plot === plot && n.parentId === parentId);
}

export function nodesAtLevel(nodes: PlotNode[], plot: Plot, level: number): PlotNode[] {
  return nodes.filter((n) => n.plot === plot && n.level === level);
}

export function maxLevel(nodes: PlotNode[], plot: Plot): number {
  return nodes.reduce((max, n) => (n.plot === plot && n.level > max ? n.level : max), 0);
}

/** The chain from the first-level ancestor down to the node itself. Empty if the id is unknown. */
export function pathTo(nodes: PlotNode[], id: string): PlotNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: PlotNode[] = [];
  let current = byId.get(id);
  while (current && path.length <= nodes.length) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** The node's id followed by every descendant's id. */
export function subtreeIds(nodes: PlotNode[], id: string): string[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const node of nodes) {
      if (node.parentId === ids[i]) ids.push(node.id);
    }
  }
  return ids;
}

export function isLeaf(nodes: PlotNode[], id: string): boolean {
  return !nodes.some((n) => n.parentId === id);
}

/** Leaves of one plot in reading order (depth first, children in the order they were added). */
export function leavesOf(nodes: PlotNode[], plot: Plot): PlotNode[] {
  const leaves: PlotNode[] = [];
  const visit = (node: PlotNode) => {
    const kids = childrenOf(nodes, plot, node.id);
    if (kids.length === 0) leaves.push(node);
    else kids.forEach(visit);
  };
  childrenOf(nodes, plot, null).forEach(visit);
  return leaves;
}

/** The first leaf at or below a node, following first children. */
export function firstLeafUnder(nodes: PlotNode[], id: string): PlotNode | null {
  let current = nodes.find((n) => n.id === id) ?? null;
  while (current) {
    const next: PlotNode | undefined = nodes.find((n) => n.parentId === current!.id);
    if (!next) return current;
    current = next;
  }
  return null;
}

/* ---------- Layout ---------- */

/**
 * Rows for a level-column drawing of one plot: each leaf takes the next row,
 * and a parent sits midway between its first and last child. Columns are just
 * `node.level`.
 */
export function layoutTree(nodes: PlotNode[], plot: Plot): { rows: Map<string, number>; rowCount: number } {
  const rows = new Map<string, number>();
  let next = 0;
  const place = (node: PlotNode) => {
    const kids = childrenOf(nodes, plot, node.id);
    if (kids.length === 0) {
      rows.set(node.id, next++);
      return;
    }
    kids.forEach(place);
    const first = rows.get(kids[0].id) ?? 0;
    const last = rows.get(kids[kids.length - 1].id) ?? first;
    rows.set(node.id, (first + last) / 2);
  };
  childrenOf(nodes, plot, null).forEach(place);
  return { rows, rowCount: next };
}

/* ---------- Document anchors ---------- */

/**
 * Where a node's anchor goes among the anchors already in the document.
 *
 * `anchorIds` are the node ids of the existing anchors in document order, and
 * `path` is the active root-to-leaf chain that contains the node. The result
 * is an index into `anchorIds`: insert the new anchor immediately before the
 * anchor at that index, or at the end of the document when it equals
 * `anchorIds.length`.
 *
 * The rule: go just before the nearest later node on the path that already
 * has an anchor (so a level 2 node lands between level 1 and level 3). With
 * nothing later, go at the end of the nearest earlier node's section, which
 * is just before whatever anchor follows it. With neither, go at the end.
 */
export function anchorInsertIndex(anchorIds: string[], path: string[], nodeId: string): number {
  const at = path.indexOf(nodeId);
  if (at === -1) return anchorIds.length;
  for (let i = at + 1; i < path.length; i++) {
    const index = anchorIds.indexOf(path[i]);
    if (index !== -1) return index;
  }
  for (let i = at - 1; i >= 0; i--) {
    const index = anchorIds.indexOf(path[i]);
    if (index !== -1) return index + 1;
  }
  return anchorIds.length;
}

/* ---------- Branches and their writing ---------- */

/**
 * The branch a new plot point belongs to. The first one chosen under a parent
 * continues the parent's branch; any later one, and any first-level plot
 * point, starts a branch of its own (named after itself).
 */
export function branchFor(nodes: Pick<PlotNode, "id" | "parentId" | "branch">[], parentId: string | null, id: string): string {
  const parent = parentId ? nodes.find((n) => n.id === parentId) : undefined;
  if (!parent) return id;
  return nodes.some((n) => n.parentId === parentId) ? id : parent.branch;
}

/** Give branches to plot points saved before branches existed, as if each had been added in order. */
export function assignBranches<T extends { id: string; parentId: string | null; branch?: string }>(
  nodes: T[],
): (T & { branch: string })[] {
  const done: (T & { branch: string })[] = [];
  for (const node of nodes) {
    done.push({ ...node, branch: node.branch ?? branchFor(done, node.parentId, node.id) });
  }
  return done;
}

/* ---------- Summaries for prompts ---------- */

/** A compact text listing of one plot's tree, for giving the model context about the other plot. */
export function describeTree(nodes: PlotNode[], plot: Plot, maxChars = 4000): string {
  const lines: string[] = [];
  const visit = (node: PlotNode) => {
    const indent = "  ".repeat(node.level - 1);
    lines.push(`${indent}L${node.level} ${node.title}${node.isEnding ? " (ending)" : ""}: ${node.summary}`);
    childrenOf(nodes, plot, node.id).forEach(visit);
  };
  childrenOf(nodes, plot, null).forEach(visit);
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}
