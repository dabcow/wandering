import assert from "node:assert/strict";
import { test } from "node:test";
import { fileStem, manuscriptBlocks, tellingOrder, toHtml, toMarkdown, toPlainText } from "./manuscript.ts";
import type { PlotNode } from "./types.ts";

const text = (value: string, marks: string[] = []) => ({ type: "text", text: value, marks: marks.map((type) => ({ type })) });
const para = (...content: object[]) => ({ type: "paragraph", content });
const node = (id: string, level: number, plot: "main" | "b" = "main"): PlotNode => ({
  id,
  parentId: null,
  level,
  title: id,
  summary: "",
  source: "user",
  isEnding: false,
  plot,
  branch: id,
});

test("a telling weaves the subplot in beat by beat, main plot first", () => {
  const main = [node("m1", 1), node("m2", 2), node("m3", 3)];
  const sub = [node("b1", 1, "b"), node("b2", 2, "b")];
  assert.deepEqual(tellingOrder(main, sub), ["m1", "b1", "m2", "b2", "m3"]);
  assert.deepEqual(tellingOrder(main, []), ["m1", "m2", "m3"]);
});

test("the manuscript joins the chosen plot points' writing and drops blank lines", () => {
  const blocks = manuscriptBlocks(
    [para(text("Before."))],
    { a: [para(text("A.")), { type: "paragraph" }], b: [para(text("B."))], other: [para(text("Not chosen."))] },
    ["a", "missing", "b"],
  );
  assert.deepEqual(blocks.map((b) => b.content?.[0]?.text), ["Before.", "A.", "B."]);
});

test("plain text, Markdown and HTML keep the formatting each can carry", () => {
  const blocks = [
    para(text("Plain "), text("bold", ["bold"]), text(" and "), text("slanted", ["italic"]), text(".")),
    { type: "horizontalRule" },
    { type: "bulletList", content: [{ type: "listItem", content: [para(text("one"))] }] },
    { type: "blockquote", content: [para(text("<quoted>"))] },
  ];
  assert.equal(toPlainText(blocks, "Title"), "Title\n\nPlain bold and slanted.\n\n* * *\n\n• one\n\n    <quoted>\n");
  assert.equal(
    toMarkdown(blocks, "Title"),
    "# Title\n\nPlain **bold** and *slanted*.\n\n* * *\n\n- one\n\n> <quoted>\n",
  );
  assert.equal(
    toHtml(blocks),
    '<p>Plain <strong>bold</strong> and <em>slanted</em>.</p>\n<p class="scene-break">* * *</p>\n<ul><li><p>one</p></li></ul>\n<blockquote><p>&lt;quoted&gt;</p></blockquote>',
  );
});

test("Markdown keeps spaces outside emphasis markers and escapes its own symbols", () => {
  assert.equal(toMarkdown([para(text("a "), text(" b ", ["italic"]), text("c*d"))]), "a  *b* c\\*d\n");
});

test("file names come from the title", () => {
  assert.equal(fileStem("The Last Light: Part 1"), "the-last-light-part-1");
  assert.equal(fileStem("   "), "my-story");
});
