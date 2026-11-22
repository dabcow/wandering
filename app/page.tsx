"use client";

import { ArrowRight, PenLine, Rabbit, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountConcept } from "@/components/AccountConcept";
import { GuideRail } from "@/components/GuideRail";
import { IdeaInput } from "@/components/IdeaInput";
import { PacingSlider } from "@/components/PacingSlider";
import { ProjectMenu } from "@/components/ProjectMenu";
import { ReviewStep } from "@/components/ReviewStep";
import { ErrorNotice, Loading } from "@/components/Status";
import { Stepper } from "@/components/Stepper";
import { Toast, useToast } from "@/components/Toast";
import { TreeStep } from "@/components/TreeStep";
import { WriteStep } from "@/components/WriteStep";
import type { StatusResponse } from "@/lib/ai/schemas";
import { useProject } from "@/lib/project";
import { deleteProject, emptyProject, hasWork, parseProject } from "@/lib/storage";
import type { Project, Step } from "@/lib/types";
import { useStoryAI } from "@/lib/useStoryAI";

export default function Home() {
  const { project, dispatch, hydrated, saveFailed } = useProject();
  const { toast, show } = useToast();
  const ai = useStoryAI(project, dispatch);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  /** Bumped when a different story is opened, so every step starts fresh with it. */
  const [storyKey, setStoryKey] = useState(0);
  /** The writer chose Suggest in step 1: show the pacing and the AI outline. */
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: StatusResponse | null) => setStatus(value))
      .catch(() => setStatus(null));
  }, []);

  // Writing saved while each branch kept its own copy ("branch/plot point" keys) is folded into
  // one text per plot point when a project loads. A page already open when that changed still
  // holds the old copies: fold them now, and rebuild the steps so the editor shows the result.
  const hasBranchCopies = Object.keys(project.sections).some((key) => key.includes("/"));
  useEffect(() => {
    if (!hasBranchCopies) return;
    const folded = parseProject(project);
    if (!folded) return;
    dispatch({ type: "hydrate", project: folded });
    setStoryKey((key) => key + 1);
    // Only when old copies turn up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBranchCopies]);

  const { idea, pacing, guideRail, nodes, step, title } = project;
  const hasIdea = idea.trim().length > 0;
  const hasRail = guideRail.length > 0;
  const hasTree = nodes.length > 0;

  const goTo = (next: Step) => dispatch({ type: "setStep", step: next });

  const canVisit = (target: Step) => {
    if (target === "idea") return true;
    // A story started from scratch has no outline, only an idea.
    if (target === "tree") return hasRail || hasTree || hasIdea;
    return hasTree;
  };

  // Suggestions are fetched only when the writer asks for them, from the Tree step.
  const enterTree = () => goTo("tree");

  const generateGuideRail = () => {
    if (
      hasTree &&
      !window.confirm(
        "A new outline starts a new tree, so the current tree will be cleared. Anything you have written is kept. Continue?",
      )
    ) {
      return;
    }
    void ai.generateGuideRail();
  };

  /** Go straight to the tree with no outline: the story grows one beat at a time, with no set length. */
  const startFromScratch = () => {
    if (hasRail) {
      if (
        !window.confirm(
          "Start from scratch without the suggested outline? Plot points you have chosen are kept, and the story map stops expecting a set number of beats.",
        )
      ) {
        return;
      }
      dispatch({ type: "clearOutline" });
    }
    setSuggesting(false);
    enterTree();
  };

  // The pacing and the outline only appear once the writer asks for a suggestion.
  const showSuggest = suggesting || hasRail || ai.guideReq.status !== "idle";

  /** Put another project on screen. The one being left stays in the library. */
  const openProject = (next: Project) => {
    // An untouched project is not worth keeping in the list.
    if (!hasWork(project)) deleteProject(project.id);
    ai.reset();
    dispatch({ type: "hydrate", project: next });
    setSuggesting(false);
    setStoryKey((key) => key + 1);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Rabbit size={20} aria-hidden />
          Wandering
        </div>
        <Stepper
          current={step}
          canVisit={canVisit}
          onVisit={(target) => (target === "tree" ? enterTree() : goTo(target))}
        />
        <div className="topbar-actions">
          <ProjectMenu
            project={project}
            onOpen={openProject}
            onNew={() => openProject(emptyProject())}
            onRename={(value) => dispatch({ type: "setTitle", title: value })}
          />
          <AccountConcept />
        </div>
      </header>

      {status && !status.configured && (
        <p className="notice notice-error">
          Story suggestions aren&apos;t set up yet, so the outline and plot suggestions won&apos;t work.
          {/* Setup steps are for whoever runs the server, so only the dev server shows them. */}
          {process.env.NODE_ENV === "development" && (
            <>
              {" "}
              Copy <code>.env.example</code> to <code>.env.local</code>, set <code>AI_API_KEY</code> and{" "}
              <code>AI_MODEL</code>, then restart the server.
            </>
          )}
        </p>
      )}
      {status?.provider === "mock" && (
        <p className="notice">
          Practice mode: the outline and plot suggestions are placeholders, not ideas about your story.
          {process.env.NODE_ENV === "development" && (
            <>
              {" "}
              Set a real provider in <code>.env.local</code> for real suggestions.
            </>
          )}
        </p>
      )}
      {saveFailed && (
        <p className="notice notice-error">
          This browser is blocking storage, so your work won&apos;t survive a reload. Use Projects to download a copy
          before you leave.
        </p>
      )}

      {!hydrated ? (
        <main className="main" aria-busy="true" />
      ) : (
        <main key={storyKey} className={`main main-${step}`}>
          {step === "idea" && (
            <>
              <StepHeader
                suit="♦"
                name="Step one"
                title="What's the story?"
                sub="Type or dictate the idea, however rough. Then build the plot yourself from scratch, or let the AI suggest a pacing and an outline to build on."
              />
              <IdeaInput value={idea} onChange={(value) => dispatch({ type: "setIdea", idea: value })} />

              {!showSuggest && (
                <div className="start-choice">
                  <button type="button" className="btn" disabled={!hasIdea} onClick={startFromScratch}>
                    {hasTree ? (
                      <>
                        Back to the tree <ArrowRight size={15} aria-hidden />
                      </>
                    ) : (
                      <>
                        <PenLine size={15} aria-hidden /> Start from scratch
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-suggest"
                    disabled={!hasIdea}
                    onClick={() => setSuggesting(true)}
                  >
                    Suggest <Sparkles size={15} aria-label="with AI" />
                  </button>
                  <p className="hint">
                    {hasIdea
                      ? "Start from scratch to build the plot beat by beat yourself, or let the AI suggest a pacing and an outline first."
                      : "Write your idea above to begin."}
                  </p>
                </div>
              )}

              {showSuggest && (
                <PacingSlider
                  value={pacing}
                  currentDepth={guideRail.length}
                  onChange={(value) => dispatch({ type: "setPacing", pacing: value })}
                />
              )}

              {ai.guideReq.status === "loading" && <Loading label="Outlining the story…" lines={5} />}
              {ai.guideReq.status === "error" && (
                <ErrorNotice message={ai.guideReq.error ?? "Could not make the outline."} onRetry={generateGuideRail} />
              )}
              {hasRail && ai.guideReq.status !== "loading" && (
                <section className="panel rail-panel" aria-label="Suggested outline">
                  <p className="label">Suggested outline · {guideRail.length} beats</p>
                  <h2>{title || "Untitled"}</h2>
                  <p className="hint">
                    A suggested structure for the story, one beat per row of the story map. Make it yours: click a title
                    or description to rewrite it, and drag a beat by its handle to move it. Plot suggestions follow the
                    outline as it stands.
                  </p>
                  {hasTree && (
                    <p className="hint">
                      Plot points you have already chosen stay in their columns; changes here shape what is suggested
                      next.
                    </p>
                  )}
                  <GuideRail
                    beats={guideRail}
                    onChange={(index, patch) => dispatch({ type: "updateBeat", index, patch })}
                    onMove={(from, to) => dispatch({ type: "moveBeat", from, to })}
                  />
                </section>
              )}

              {showSuggest && (
                <div className="step-nav">
                  <button type="button" className="btn btn-quiet" disabled={!hasIdea} onClick={startFromScratch}>
                    <PenLine size={14} aria-hidden /> Start from scratch instead
                  </button>
                  <div className="step-nav-group">
                    <button
                      type="button"
                      className={hasRail ? "btn" : "btn btn-primary"}
                      disabled={!hasIdea || ai.guideReq.status === "loading"}
                      onClick={generateGuideRail}
                    >
                      {hasRail ? <RotateCw size={14} aria-hidden /> : <Sparkles size={15} aria-hidden />}
                      {hasRail ? "New outline" : "Suggest an outline"}
                    </button>
                    {hasRail && (
                      <button type="button" className="btn btn-primary" onClick={enterTree}>
                        {hasTree ? "Back to the tree" : "Grow the tree"} <ArrowRight size={15} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "tree" && (
            <>
              <StepHeader
                suit="♥"
                name="Step two"
                title="Down the rabbit hole"
                sub="Choose what happens next, or write your own. The story map shows the whole tree; click any plot point in it to go there."
              />
              <TreeStep
                project={project}
                dispatch={dispatch}
                ai={ai}
                onBack={() => goTo("idea")}
                onWrite={() => goTo("write")}
              />
            </>
          )}

          {step === "write" && (
            <>
              <StepHeader
                suit="♠"
                name="Step three"
                title="Write it"
                sub="Write under each plot point. The document shows one branch of the story at a time; click a plot point in the tree to jump there or switch branch."
              />
              <WriteStep
                project={project}
                dispatch={dispatch}
                onToast={show}
                onBack={() => goTo("tree")}
                onReview={() => goTo("review")}
              />
            </>
          )}

          {step === "review" && (
            <>
              <StepHeader
                suit="♣"
                name="Step four"
                title="Review"
                sub="The finished text, laid out as one piece. Choose which plot points it tells in the story map, then download it or copy it."
              />
              <ReviewStep project={project} dispatch={dispatch} onToast={show} onBack={() => goTo("write")} />
            </>
          )}
        </main>
      )}

      <Toast toast={toast} />
    </div>
  );
}

function StepHeader(props: { suit: string; name: string; title: string; sub: string }) {
  return (
    <header className="step-header">
      <p className="label">
        <span className="suit" aria-hidden>
          {props.suit}
        </span>{" "}
        {props.name}
      </p>
      <h1>{props.title}</h1>
      <p className="step-sub">{props.sub}</p>
    </header>
  );
}
