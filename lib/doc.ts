/**
 * The writing is stored per plot point, not as one long document: each plot
 * point owns the blocks written under its anchor, and has that one text
 * whichever branch it is read on (a parent reads the same whichever child
 * follows it). The editor only ever holds the sections of the path being
 * told, so two branches of the same level are never in the document
 * together. Pure functions; no runtime imports.
 */
import type { JSONContent } from "@tiptap/core";

/** Node type name of the anchor block that ties a spot in the document to a plot node. */
export const ANCHOR_TYPE = "plotAnchor";

/** The blocks written under each plot point's anchor, keyed by node id. A key with no blocks is an anchor with nothing under it yet. */
export type Sections = Record<string, JSONContent[]>;

function hasText(block: JSONContent): boolean {
  if (typeof block.text === "string" && block.text.trim()) return true;
  return (block.content ?? []).some(hasText);
}

/** How many words a run of blocks holds. */
export function countWords(blocks: JSONContent[]): number {
  let count = 0;
  for (const block of blocks) {
    if (typeof block.text === "string") count += block.text.split(/\s+/).filter(Boolean).length;
    if (block.content) count += countWords(block.content);
  }
  return count;
}

/** Nothing but empty paragraphs. */
function isBlank(blocks: JSONContent[]): boolean {
  return blocks.every((block) => block.type === "paragraph" && !hasText(block));
}

/**
 * Take an editor document apart: the blocks before the first anchor are the
 * intro, and each anchor starts the section of its plot point.
 */
export function splitDoc(doc: JSONContent | null): { intro: JSONContent[]; sections: Sections } {
  const intro: JSONContent[] = [];
  const sections: Sections = {};
  let current = intro;
  for (const block of doc?.content ?? []) {
    if (block.type === ANCHOR_TYPE) {
      const nodeId = block.attrs?.nodeId;
      // A second anchor for the same plot point continues its section.
      if (typeof nodeId === "string" && nodeId) current = sections[nodeId] ??= [];
    } else {
      current.push(block);
    }
  }
  return { intro: isBlank(intro) ? [] : intro, sections };
}

/**
 * Build the editor document for one telling: the intro, then the section of
 * each plot point in `order` that has one, each under its anchor.
 */
export function composeDoc(intro: JSONContent[], sections: Sections, order: string[]): JSONContent {
  const content: JSONContent[] = [...intro];
  for (const nodeId of order) {
    if (!Object.hasOwn(sections, nodeId)) continue;
    const blocks = sections[nodeId];
    content.push({ type: ANCHOR_TYPE, attrs: { nodeId } });
    content.push(...(blocks.length > 0 ? blocks : [{ type: "paragraph" }]));
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

/** Which plot points have an anchor, and whether anything is written under it. */
export function sectionStatus(sections: Sections): Map<string, { hasText: boolean }> {
  return new Map(
    Object.entries(sections).map(([nodeId, blocks]) => [nodeId, { hasText: blocks.some(hasText) }]),
  );
}

/**
 * Writing was for a while kept separately for each branch, under keys of the
 * form "branch/nodeId" ("branch/" for the text above the first heading). Fold
 * it back into one text per plot point: plain node-id keys first, then the
 * plot point's own branch, then any other branch's copy that has text and
 * differs, so nothing written is lost. `ownBranch` names the branch a plot
 * point was first chosen on, if it still exists.
 */
export function mergeBranchWriting(
  intro: JSONContent[],
  sections: Sections,
  ownBranch: (nodeId: string) => string | undefined,
): { intro: JSONContent[]; sections: Sections } {
  type Piece = { branch: string | null; blocks: JSONContent[] };
  const pieces = new Map<string, Piece[]>();
  for (const [key, blocks] of Object.entries(sections)) {
    const slash = key.indexOf("/");
    const nodeId = slash === -1 ? key : key.slice(slash + 1);
    const branch = slash === -1 ? null : key.slice(0, slash);
    pieces.set(nodeId, [...(pieces.get(nodeId) ?? []), { branch, blocks }]);
  }

  const rank = (nodeId: string, piece: Piece) =>
    piece.branch === null ? 0 : piece.branch === ownBranch(nodeId) ? 1 : 2;
  const fold = (nodeId: string, start: JSONContent[], list: Piece[]): JSONContent[] => {
    const seen = new Set<string>();
    const out: JSONContent[] = [];
    const add = (blocks: JSONContent[]) => {
      const sig = JSON.stringify(blocks);
      if (isBlank(blocks) || seen.has(sig)) return;
      seen.add(sig);
      out.push(...blocks);
    };
    add(start);
    [...list].sort((a, b) => rank(nodeId, a) - rank(nodeId, b)).forEach((piece) => add(piece.blocks));
    return out;
  };

  const merged: Sections = {};
  let top = intro;
  for (const [nodeId, list] of pieces) {
    if (nodeId === "") top = fold("", intro, list);
    else merged[nodeId] = fold(nodeId, [], list);
  }
  return { intro: top, sections: merged };
}
