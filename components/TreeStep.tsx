"use client";

import { ArrowLeft, ArrowRight, Spade } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { newId, type Action } from "@/lib/project";
import { branchFor, childrenOf, leavesOf, moveProblem, pathTo, subtreeIds } from "@/lib/tree";
import type { Candidate, Plot, PlotNode, Project } from "@/lib/types";
import type { StoryAI } from "@/lib/useStoryAI";
import { BPlotPanel } from "./BPlotPanel";
import type { OwnPlotPoint } from "./OwnCard";
import { PlotPanel } from "./PlotPanel";
import { PlotPointEditor } from "./PlotPointEditor";
import { PlotPointView } from "./PlotPointView";
import { TreeGraph } from "./TreeGraph";

type Props = {
  project: Project;
  dispatch: Dispatch<Action>;
  ai: StoryAI;
  onBack: () => void;
  onWrite: () => void;
};

type NewNode = Pick<PlotNode, "title" | "summary" | "isEnding" | "source"> & { id?: string };

/** Where a plot starts out in view: its first branch that is still open, else any branch tip. */
function firstTip(nodes: PlotNode[], plot: Plot): string | null {
  const tips = leavesOf(nodes, plot);
  return (tips.find((n) => !n.isEnding) ?? tips[0])?.id ?? null;
}

/**
 * Step 2: grow the plot tree. One plot point at a time is in view, with its
 * possible next steps; the map of the whole tree sits below. Click any plot
 * point in the map to bring it into view.
 */
export function TreeStep({ project, dispatch, ai, onBack, onWrite }: Props) {
  const { nodes, candidates, guideRail, links, bPlot } = project;

  // Tidy the idea's wording for the Plot reminder, once per version of the idea.
  const { tidyPlot } = ai;
  useEffect(() => {
    void tidyPlot();
  }, [tidyPlot]);
  const hasB = bPlot !== null;

  const [plot, setPlot] = useState<Plot>("main");
  /** The plot point being edited, in place on its card. Always the one in view. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [bPanelOpen, setBPanelOpen] = useState(false);
  /** The plot point in view, per plot; null is the start of the plot. */
  const [focus, setFocus] = useState<Record<Plot, string | null>>(() => ({
    main: firstTip(nodes, "main"),
    b: firstTip(nodes, "b"),
  }));

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const activePlot: Plot = hasB ? plot : "main";
  const focusNode = nodes.find((n) => n.id === focus[activePlot] && n.plot === activePlot) ?? null;

  const leaves = leavesOf(nodes, "main");
  const ended = leaves.filter((n) => n.isEnding).length;

  /** Bring a plot point (or the start of the plot) into view. */
  const focusOn = (forPlot: Plot, id: string | null) => {
    if (id !== selectedId) setSelectedId(null);
    setPlot(forPlot);
    setFocus((current) => ({ ...current, [forPlot]: id }));
  };

  const addNode = (parentId: string | null, values: NewNode): PlotNode => {
    const parent = parentId ? nodes.find((n) => n.id === parentId) : null;
    const id = values.id ?? newId();
    const node: PlotNode = {
      id,
      parentId,
      level: parent ? parent.level + 1 : 1,
      title: values.title,
      summary: values.summary,
      source: values.source,
      isEnding: values.isEnding,
      plot: activePlot,
      branch: branchFor(nodes, parentId, id),
    };
    dispatch({ type: "addNode", node });
    return node;
  };

  /** Choose a suggestion and move straight on to it. Its own suggestions wait until the writer asks. */
  const explore = (candidate: Candidate, parentId: string | null) => {
    const node = addNode(parentId, { ...candidate, source: "ai" });
    setFocus((current) => ({ ...current, [activePlot]: node.id }));
  };

  const prune = (id: string) => {
    const doomed = subtreeIds(nodes, id);
    const below = doomed.length - 1;
    if (
      below > 0 &&
      !window.confirm(`Delete this plot point and the ${below} that follow${below === 1 ? "s" : ""} it?`)
    ) {
      return;
    }
    const node = nodes.find((n) => n.id === id);
    if (selectedId && doomed.includes(selectedId)) setSelectedId(null);
    // If the plot point in view goes, fall back to what it grew from.
    if (node && focus[node.plot] && doomed.includes(focus[node.plot] as string)) {
      setFocus((current) => ({ ...current, [node.plot]: node.parentId }));
    }
    dispatch({ type: "pruneNode", id });
  };

  const startBPlot = (premise: string) => {
    dispatch({ type: "startBPlot", premise });
    setBPanelOpen(false);
    setPlot("b");
    setFocus((current) => ({ ...current, b: null }));
    showPicker();
  };

  const removeBPlot = () => {
    const count = nodes.filter((n) => n.plot === "b").length;
    if (count > 0 && !window.confirm(`Remove the subplot and its ${count} plot point${count === 1 ? "" : "s"}?`)) {
      return;
    }
    if (selected?.plot === "b") setSelectedId(null);
    setPlot("main");
    setFocus((current) => ({ ...current, b: null }));
    setBPanelOpen(false);
    dispatch({ type: "removeBPlot" });
  };

  // The tree picks out the branch in view and fades the rest.
  const inView = focusNode
    ? new Set([...pathTo(nodes, focusNode.id).map((n) => n.id), ...subtreeIds(nodes, focusNode.id)])
    : undefined;

  /** Scroll the plot point in view back on screen, as after choosing one in the map below. */
  const showPicker = () => {
    const box = picker.current;
    // Clear of the sticky top bar is on screen enough.
    if (!box || box.getBoundingClientRect().top >= 72) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  const link = (otherId: string) =>
    selected?.plot === "main" ? { mainId: selected.id, bId: otherId } : { mainId: otherId, bId: selected?.id ?? "" };

  return (
    <>
      {/* The plot point in view and its next steps on the left, the story map beside them. */}
      <PlotPanel idea={project.idea} summary={project.plotSummary} req={ai.plotReq} onEdit={onBack} />

      <div className="tree-layout">
        <div ref={picker} className="tree-work">
          <PlotPointView
            nodes={nodes}
            candidates={candidates}
            guideRail={guideRail}
            hasB={hasB}
            plot={activePlot}
            focusId={focusNode?.id ?? null}
            reqs={ai.groupReqs}
            onPlot={(value) => focusOn(value, focus[value])}
            onFocus={(id) => focusOn(activePlot, id)}
            onLoad={(parentId) => void ai.loadOptions(activePlot, parentId)}
            onExplore={explore}
            onKeep={(candidate, parentId) => addNode(parentId, { ...candidate, source: "ai" })}
            onRemove={prune}
            onAddOwn={(parentId, own: OwnPlotPoint) => addNode(parentId, { ...own, source: "user" })}
            onEdit={setSelectedId}
            editor={
              selected && selected.id === focusNode?.id ? (
                <PlotPointEditor
                  key={selected.id}
                  node={selected}
                  nodes={nodes}
                  links={links}
                  hasB={hasB}
                  onPatch={(patch) => dispatch({ type: "updateNode", id: selected.id, patch })}
                  onPrune={() => prune(selected.id)}
                  onAddLink={(otherId) => dispatch({ type: "addLink", link: link(otherId) })}
                  onRemoveLink={(otherId) => dispatch({ type: "removeLink", link: link(otherId) })}
                  onMove={(parentId) => dispatch({ type: "moveNode", id: selected.id, parentId })}
                  onDone={() => setSelectedId(null)}
                />
              ) : undefined
            }
          />
        </div>

        <section className="map" aria-labelledby="map-title">
          <div className="tree-bar">
            <div>
              <h2 id="map-title" className="map-title">
                Story map
              </h2>
              <p className="tree-stats">
                {nodes.length === 0
                  ? "No plot points yet."
                  : `${nodes.length} plot point${nodes.length === 1 ? "" : "s"} · ${leaves.length} branch${leaves.length === 1 ? "" : "es"} · ${ended} ended. Click one to go there, or hold and drag it onto another to move it.`}
              </p>
            </div>
            <button type="button" className="btn" aria-expanded={bPanelOpen} onClick={() => setBPanelOpen(!bPanelOpen)}>
              <Spade size={14} aria-hidden /> {hasB ? "Subplot" : "Add a subplot"}
            </button>
          </div>

          {bPanelOpen && (
            <BPlotPanel
              premise={bPlot?.premise ?? null}
              premiseReq={ai.premiseReq}
              onSuggest={ai.suggestPremise}
              onStart={startBPlot}
              onChangePremise={(premise) => dispatch({ type: "setBPremise", premise })}
              onRemove={removeBPlot}
              onClose={() => setBPanelOpen(false)}
            />
          )}

          <TreeGraph
            nodes={nodes}
            beats={guideRail}
            links={links}
            showB={hasB}
            selectedId={selectedId}
            topId={focusNode?.id}
            highlight={inView}
            activeLevel={(focusNode?.level ?? 0) + 1}
            vertical
            onMove={(id, parentId) => dispatch({ type: "moveNode", id, parentId })}
            moveProblem={(id, parentId) => moveProblem(nodes, id, parentId)}
            onSelect={(node) => {
              focusOn(node.plot, node.id);
              showPicker();
            }}
          />
        </section>
      </div>

      <div className="step-nav">
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> Idea
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={childrenOf(nodes, "main", null).length === 0}
          title={nodes.length === 0 ? "Choose at least one plot point first" : undefined}
          onClick={onWrite}
        >
          Write the story <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </>
  );
}
