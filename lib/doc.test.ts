import assert from "node:assert/strict";
import { test } from "node:test";
import { ANCHOR_TYPE, composeDoc, countWords, mergeBranchWriting, sectionStatus, splitDoc } from "./doc.ts";
import type { Sections } from "./doc.ts";

const para = (text?: string) =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const anchor = (nodeId: string) => ({ type: ANCHOR_TYPE, attrs: { nodeId } });

test("splitDoc files each block under the anchor before it", () => {
  const doc = {
    type: "doc",
    content: [para("Epigraph"), anchor("a1"), para("One"), para("Two"), anchor("a2"), para("Three")],
  };
  assert.deepEqual(splitDoc(doc), {
    intro: [para("Epigraph")],
    sections: { a1: [para("One"), para("Two")], a2: [para("Three")] },
  });
});

test("splitDoc drops an intro that is only empty paragraphs", () => {
  const { intro, sections } = splitDoc({ type: "doc", content: [para(), anchor("a1"), para()] });
  assert.deepEqual(intro, []);
  assert.deepEqual(sections, { a1: [para()] });
});

test("composeDoc shows only the sections on the path, in path order", () => {
  const sections = { a1: [para("One")], a2: [para("Two")], b2: [para("Other branch")], a3: [] };
  const doc = composeDoc([], sections, ["a1", "a2", "a3", "missing"]);
  assert.deepEqual(doc.content, [
    anchor("a1"),
    para("One"),
    anchor("a2"),
    para("Two"),
    // An anchor with nothing under it gets a paragraph to type in.
    anchor("a3"),
    para(),
  ]);
  // The other branch of level 2 is not in the document at all.
  assert.ok(!JSON.stringify(doc).includes("Other branch"));
});

test("switching branch and back keeps both branches' text", () => {
  let sections: Sections = { a1: [para("One")], a2: [para("Two")] };
  // Tell the other branch: a1 then b2. The editor owns a1 and b2 only.
  const other = composeDoc([], sections, ["a1", "b2"]);
  other.content?.push(anchor("b2"), para("Other branch"));
  sections = { ...sections, ...splitDoc(other).sections };
  assert.deepEqual(sections.a2, [para("Two")]);
  assert.deepEqual(sections.b2, [para("Other branch")]);
  // Back on the first branch, its level 2 is intact and the other one is absent.
  const back = composeDoc([], sections, ["a1", "a2"]);
  assert.deepEqual(back.content, [anchor("a1"), para("One"), anchor("a2"), para("Two")]);
});

test("an empty project composes to one empty paragraph", () => {
  assert.deepEqual(composeDoc([], {}, []), { type: "doc", content: [para()] });
});

test("countWords counts the words in nested blocks", () => {
  assert.equal(countWords([para("One two  three"), para(), para("four")]), 4);
  assert.equal(countWords([{ type: "bulletList", content: [{ type: "listItem", content: [para("five six")] }] }]), 2);
  assert.equal(countWords([]), 0);
});

test("sectionStatus tells an empty anchor from a written one", () => {
  const status = sectionStatus({ a1: [para("One")], a2: [para()], a3: [] });
  assert.deepEqual(status.get("a1"), { hasText: true });
  assert.deepEqual(status.get("a2"), { hasText: false });
  assert.deepEqual(status.get("a3"), { hasText: false });
  assert.equal(status.has("zz"), false);
});

test("per-branch writing folds into one text per plot point, losing nothing", () => {
  const own: Record<string, string> = { p: "a", c1: "a", c2: "c2" };
  const merged = mergeBranchWriting(
    [],
    {
      // The parent p was written on two branches: its own (a) and the second child's (c2).
      "c2/p": [para("Second telling.")],
      "a/p": [para("First telling.")],
      "a/c1": [para("Child one.")],
      "c2/c2": [para("Child two.")],
      // The same text on two branches is kept once.
      "a/x": [para("Same.")],
      "c2/x": [para("Same.")],
      // Text above the first heading joins the shared intro.
      "a/": [para("Opening.")],
      // An empty heading still counts as placed.
      "a/e": [],
      // Already per plot point: kept, and first.
      p: [para("Plain.")],
    },
    (nodeId) => own[nodeId] ?? "a",
  );
  assert.deepEqual(merged.sections.p, [para("Plain."), para("First telling."), para("Second telling.")]);
  assert.deepEqual(merged.sections.c1, [para("Child one.")]);
  assert.deepEqual(merged.sections.c2, [para("Child two.")]);
  assert.deepEqual(merged.sections.x, [para("Same.")]);
  assert.deepEqual(merged.sections.e, []);
  assert.deepEqual(merged.intro, [para("Opening.")]);
});
