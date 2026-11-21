import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchorInsertIndex,
  assignBranches,
  branchFor,
  depthForPacing,
  firstLeafUnder,
  layoutTree,
  leavesOf,
  pathTo,
  subtreeIds,
} from "./tree.ts";
import type { PlotNode } from "./types.ts";

function node(id: string, parentId: string | null, level: number, plot: "main" | "b" = "main"): PlotNode {
  // Each test node starts as its own branch; the shared tree below gets real branches.
  return { id, parentId, level, plot, title: id, summary: "", source: "ai", isEnding: false, branch: id };
}

/*
 *  a1 ─ a2 ─ a3
 *     └ b2 ─ b3
 *          └ c3
 */
const tree: PlotNode[] = [
  node("a1", null, 1),
  node("a2", "a1", 2),
  node("b2", "a1", 2),
  node("a3", "a2", 3),
  node("b3", "b2", 3),
  node("c3", "b2", 3),
  node("x1", null, 1, "b"),
];

test("pathTo runs from the first level down to the node", () => {
  assert.deepEqual(pathTo(tree, "c3").map((n) => n.id), ["a1", "b2", "c3"]);
  assert.deepEqual(pathTo(tree, "a1").map((n) => n.id), ["a1"]);
  assert.deepEqual(pathTo(tree, "missing"), []);
});

test("subtreeIds includes the node and every descendant", () => {
  assert.deepEqual(subtreeIds(tree, "b2").sort(), ["b2", "b3", "c3"]);
  assert.deepEqual(subtreeIds(tree, "a3"), ["a3"]);
});

test("leavesOf lists one plot's leaves in reading order", () => {
  assert.deepEqual(leavesOf(tree, "main").map((n) => n.id), ["a3", "b3", "c3"]);
  assert.deepEqual(leavesOf(tree, "b").map((n) => n.id), ["x1"]);
});

test("firstLeafUnder follows first children", () => {
  assert.equal(firstLeafUnder(tree, "a1")?.id, "a3");
  assert.equal(firstLeafUnder(tree, "b2")?.id, "b3");
  assert.equal(firstLeafUnder(tree, "c3")?.id, "c3");
});

test("layoutTree gives each leaf a row and centres parents on their children", () => {
  const { rows, rowCount } = layoutTree(tree, "main");
  assert.equal(rowCount, 3);
  assert.equal(rows.get("a3"), 0);
  assert.equal(rows.get("b3"), 1);
  assert.equal(rows.get("c3"), 2);
  assert.equal(rows.get("b2"), 1.5);
  assert.equal(rows.get("a1"), 0.75);
});

test("depthForPacing spans 12 levels (slow burn) to 5 (fast)", () => {
  assert.equal(depthForPacing(0), 12);
  assert.equal(depthForPacing(100), 5);
  assert.equal(depthForPacing(50), 9);
  assert.equal(depthForPacing(-20), 12);
  assert.equal(depthForPacing(400), 5);
});

test("the first plot point under a parent continues its branch; later ones start their own", () => {
  const grown: PlotNode[] = [];
  const add = (id: string, parentId: string | null) => {
    grown.push({ ...node(id, parentId, 1), branch: branchFor(grown, parentId, id) });
  };
  add("a1", null);
  add("a2", "a1"); // first under a1: same branch
  add("b2", "a1"); // second under a1: a new branch
  add("a3", "a2");
  add("c1", null); // another opening: its own branch
  assert.deepEqual(
    grown.map((n) => n.branch),
    ["a1", "a1", "b2", "a1", "c1"],
  );
  // Each leaf ends a different branch.
  assert.deepEqual(leavesOf(grown, "main").map((n) => n.branch), ["a1", "b2", "c1"]);
});

test("deleting the first child does not hand its branch to a sibling", () => {
  const grown = assignBranches([
    { id: "a1", parentId: null },
    { id: "a2", parentId: "a1" },
    { id: "b2", parentId: "a1" },
  ]);
  const withoutFirst = grown.filter((n) => n.id !== "a2");
  assert.equal(withoutFirst.find((n) => n.id === "b2")?.branch, "b2");
  // A plot point added now is not the first under a1 either.
  assert.equal(branchFor(withoutFirst, "a1", "c2"), "c2");
  // With b2 gone as well, a1 is a leaf again and the next plot point continues it.
  assert.equal(branchFor(grown.slice(0, 1), "a1", "d2"), "a1");
});

test("assignBranches fills in branches for older saves and keeps ones already set", () => {
  const saved = assignBranches([
    { id: "a1", parentId: null },
    { id: "a2", parentId: "a1" },
    { id: "b2", parentId: "a1", branch: "kept" },
    { id: "b3", parentId: "b2" },
  ]);
  assert.deepEqual(saved.map((n) => n.branch), ["a1", "a1", "kept", "kept"]);
});

test("a level 2 anchor goes between the level 1 and level 3 anchors", () => {
  const path = ["a1", "a2", "a3"];
  // Document holds level 1 then level 3; level 2 must land at index 1, between them.
  assert.equal(anchorInsertIndex(["a1", "a3"], path, "a2"), 1);
});

test("an anchor goes just before the nearest later anchor on its path", () => {
  const path = ["a1", "b2", "c3"];
  // Another branch's anchor (a2) sits between; b2 still goes right before c3.
  assert.equal(anchorInsertIndex(["a1", "a2", "c3"], path, "b2"), 2);
  // No earlier anchor at all: still before the later one.
  assert.equal(anchorInsertIndex(["c3"], path, "a1"), 0);
});

test("with nothing later, an anchor goes at the end of the nearest earlier section", () => {
  const path = ["a1", "a2", "a3"];
  assert.equal(anchorInsertIndex(["a1"], path, "a2"), 1);
  // The earlier section ends where the next anchor of any branch begins.
  assert.equal(anchorInsertIndex(["a1", "b2", "b3"], path, "a2"), 1);
  // Skips a missing level 2 and attaches after level 1.
  assert.equal(anchorInsertIndex(["a1", "b2"], path, "a3"), 1);
});

test("with no anchors on its path, an anchor goes at the end", () => {
  assert.equal(anchorInsertIndex([], ["a1", "a2"], "a2"), 0);
  assert.equal(anchorInsertIndex(["x1", "b3"], ["a1", "a2"], "a2"), 2);
  // A node that is not on the given path also falls back to the end.
  assert.equal(anchorInsertIndex(["a1"], ["a1", "a2"], "zz"), 1);
});
