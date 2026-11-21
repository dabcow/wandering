"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import type { GuideRailResponse, OptionsResponse, PremiseResponse, TidyResponse } from "./ai/schemas";
import { errorMessage, postJSON } from "./api";
import { newId, type Action } from "./project";
import { OPTIONS_PER_PARENT, childrenOf, describeTree, groupKey, pathTo } from "./tree";
import type { Plot, PlotNode, Project } from "./types";

export type Req = { status: "idle" | "loading" | "error"; error?: string };
export const IDLE: Req = { status: "idle" };

/** The AI calls, with their loading and error state. */
export function useStoryAI(project: Project, dispatch: Dispatch<Action>) {
  const [guideReq, setGuideReq] = useState<Req>(IDLE);
  const [premiseReq, setPremiseReq] = useState<Req>(IDLE);
  const [plotReq, setPlotReq] = useState<Req>(IDLE);
  /** Request state per suggestion group, keyed by groupKey(plot, parentId). */
  const [groupReqs, setGroupReqs] = useState<Record<string, Req>>({});

  // Bumped whenever the tree is replaced, so replies meant for the old tree are dropped.
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const latest = useRef(project);
  useEffect(() => {
    latest.current = project;
  });

  const { idea, pacing, guideRail, nodes, candidates, bPlot } = project;

  /** Returns true once the new rail is in place. */
  const generateGuideRail = useCallback(async (): Promise<boolean> => {
    const mine = ++generation.current;
    inFlight.current.clear();
    setGroupReqs({});
    setGuideReq({ status: "loading" });
    try {
      const rail = await postJSON<GuideRailResponse>("/api/guide-rail", {
        idea: idea.slice(0, 8000),
        pacing,
      });
      if (mine !== generation.current) return false;
      dispatch({ type: "setGuideRail", title: rail.title, beats: rail.beats });
      setGuideReq(IDLE);
      return true;
    } catch (error) {
      if (mine !== generation.current) return false;
      setGuideReq({ status: "error", error: errorMessage(error) });
      return false;
    }
  }, [idea, pacing, dispatch]);

  /**
   * Fetch suggestions for the children of one parent (null for level 1).
   * Calling it again for a group that already has some asks for different ones.
   *
   * `overrides` supply values that were set in the same event and so are not
   * in the project yet: a just-started B plot's premise, or the path down to
   * a parent that was added a moment ago.
   */
  const loadOptions = useCallback(
    async (
      plot: Plot,
      parentId: string | null,
      overrides?: { bPremise?: string; path?: PlotNode[] },
    ) => {
      const key = groupKey(plot, parentId);
      // Works without an outline too: a story started from scratch has none.
      if (inFlight.current.has(key)) return;
      const path = overrides?.path ?? (parentId ? pathTo(nodes, parentId) : []);
      if (parentId && path.length === 0) return;

      const offered = [
        ...(candidates[key] ?? []).map((c) => c.title),
        ...childrenOf(nodes, plot, parentId).map((n) => n.title),
      ];
      const mine = generation.current;
      inFlight.current.add(key);
      setGroupReqs((reqs) => ({ ...reqs, [key]: { status: "loading" } }));
      try {
        const { options } = await postJSON<OptionsResponse>("/api/options", {
          idea: idea.slice(0, 8000),
          pacing,
          guideRail,
          path: path.map((n) => ({ title: n.title.slice(0, 200), summary: n.summary.slice(0, 1000) })),
          plot,
          bPremise: (overrides?.bPremise ?? bPlot?.premise ?? "").slice(0, 2000),
          otherPlot: describeTree(nodes, plot === "main" ? "b" : "main"),
          avoid: [...new Set(offered)].slice(0, 40).map((t) => t.slice(0, 200)),
          count: OPTIONS_PER_PARENT,
        });
        if (mine !== generation.current) return;
        // The parent may have been pruned while we waited.
        if (parentId && !latest.current.nodes.some((n) => n.id === parentId)) return;
        dispatch({
          type: "addCandidates",
          key,
          candidates: options.map((option) => ({ id: newId(), ...option })),
        });
        setGroupReqs((reqs) => ({ ...reqs, [key]: IDLE }));
      } catch (error) {
        if (mine !== generation.current) return;
        setGroupReqs((reqs) => ({ ...reqs, [key]: { status: "error", error: errorMessage(error) } }));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [idea, pacing, guideRail, nodes, candidates, bPlot, dispatch],
  );

  /** Returns a suggested B-plot premise, or null if the request failed. */
  const suggestPremise = useCallback(async (): Promise<string | null> => {
    setPremiseReq({ status: "loading" });
    try {
      const { premise } = await postJSON<PremiseResponse>("/api/b-plot", {
        idea: idea.slice(0, 8000),
        mainTree: describeTree(nodes, "main"),
      });
      setPremiseReq(IDLE);
      return premise;
    } catch (error) {
      setPremiseReq({ status: "error", error: errorMessage(error) });
      return null;
    }
  }, [idea, nodes]);

  /**
   * Tidy the idea's typos for the Plot reminder. Does nothing if the stored
   * version was made from the idea as it is now. On failure the reminder
   * simply shows the idea as typed.
   */
  const tidyPlot = useCallback(async () => {
    const from = idea.trim();
    if (!from || latest.current.plotSummary?.from === from || inFlight.current.has("plot")) return;
    const mine = generation.current;
    inFlight.current.add("plot");
    setPlotReq({ status: "loading" });
    try {
      const { text } = await postJSON<TidyResponse>("/api/plot", { idea: from.slice(0, 8000) });
      if (mine !== generation.current) return;
      dispatch({ type: "setPlotSummary", from, text });
      setPlotReq(IDLE);
    } catch (error) {
      if (mine !== generation.current) return;
      setPlotReq({ status: "error", error: errorMessage(error) });
    } finally {
      inFlight.current.delete("plot");
    }
  }, [idea, dispatch]);

  /** Forget everything in flight, as when the project is cleared. */
  const reset = useCallback(() => {
    generation.current++;
    inFlight.current.clear();
    setGuideReq(IDLE);
    setPremiseReq(IDLE);
    setPlotReq(IDLE);
    setGroupReqs({});
  }, []);

  return {
    guideReq,
    premiseReq,
    plotReq,
    groupReqs,
    generateGuideRail,
    loadOptions,
    suggestPremise,
    tidyPlot,
    reset,
  };
}

export type StoryAI = ReturnType<typeof useStoryAI>;
