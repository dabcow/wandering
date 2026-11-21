/**
 * The finished text of one telling of the story, for the Review step and its
 * exports: the writing under each chosen plot point, in story order, with no
 * plot point headings. Pure functions over TipTap JSON; no runtime imports, so
 * the tests run on plain Node.
 */
import type { JSONContent } from "@tiptap/core";
import type { Plot, PlotNode } from "./types";

/* ---------- Which writing, in which order ---------- */

/**
 * The plot points a telling covers, in reading order: the chosen main-plot
 * branch, with the chosen subplot branch (if any) woven in beat by beat, the
 * main plot first within a beat.
 */
export function tellingOrder(mainPath: PlotNode[], bPath: PlotNode[]): string[] {
  const rank = (plot: Plot) => (plot === "b" ? 1 : 0);
  return [...mainPath, ...bPath].sort((x, y) => x.level - y.level || rank(x.plot) - rank(y.plot)).map((n) => n.id);
}

function hasText(block: JSONContent): boolean {
  if (typeof block.text === "string" && block.text.trim()) return true;
  return (block.content ?? []).some(hasText);
}

/**
 * The text of a telling as one run of blocks: anything written above the first
 * plot point, then each plot point's writing in order. Empty paragraphs (the
 * blank lines left under unwritten headings) are dropped.
 */
export function manuscriptBlocks(
  intro: JSONContent[],
  sections: Record<string, JSONContent[]>,
  order: string[],
): JSONContent[] {
  const blocks = [...intro, ...order.flatMap((id) => sections[id] ?? [])];
  return blocks.filter((block) => block.type !== "paragraph" || hasText(block));
}

/* ---------- Inline text ---------- */

/** One run of text with its formatting, or a line break inside a paragraph. */
export type Run = { text: string; bold: boolean; italic: boolean; strike: boolean; code: boolean } | { lineBreak: true };

/** The runs of a text block (paragraph, heading). */
export function runsOf(block: JSONContent): Run[] {
  const runs: Run[] = [];
  for (const child of block.content ?? []) {
    if (child.type === "hardBreak") {
      runs.push({ lineBreak: true });
    } else if (typeof child.text === "string") {
      const marks = new Set((child.marks ?? []).map((m) => m.type));
      runs.push({
        text: child.text,
        bold: marks.has("bold"),
        italic: marks.has("italic"),
        strike: marks.has("strike"),
        code: marks.has("code"),
      });
    } else {
      runs.push(...runsOf(child));
    }
  }
  return runs;
}

/** Plain text of a text block, line breaks kept. */
function inlineText(block: JSONContent): string {
  return runsOf(block)
    .map((run) => ("lineBreak" in run ? "\n" : run.text))
    .join("");
}

/** The items of a list, each as its blocks. */
function listItems(list: JSONContent): JSONContent[][] {
  return (list.content ?? []).map((item) => item.content ?? []);
}

/* ---------- Plain text ---------- */

function plainBlock(block: JSONContent): string {
  switch (block.type) {
    case "bulletList":
      return listItems(block)
        .map((item) => `• ${item.map(plainBlock).join("\n  ")}`)
        .join("\n");
    case "orderedList": {
      const start = Number(block.attrs?.start ?? 1);
      return listItems(block)
        .map((item, i) => `${start + i}. ${item.map(plainBlock).join("\n   ")}`)
        .join("\n");
    }
    case "blockquote":
      return (block.content ?? [])
        .map(plainBlock)
        .join("\n\n")
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
    case "horizontalRule":
      return "* * *";
    default:
      return inlineText(block);
  }
}

/** The telling as plain text, paragraphs separated by a blank line. */
export function toPlainText(blocks: JSONContent[], title = ""): string {
  const parts = [title.trim(), ...blocks.map(plainBlock)].filter((part) => part.trim());
  return `${parts.join("\n\n")}\n`;
}

/* ---------- Markdown ---------- */

const escapeMarkdown = (text: string) => text.replace(/([\\`*_[\]])/g, "\\$1");

function markdownInline(block: JSONContent): string {
  return runsOf(block)
    .map((run) => {
      if ("lineBreak" in run) return "  \n";
      if (run.code) return `\`${run.text}\``;
      // Keep surrounding spaces outside the markers, or Markdown won't read them.
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text) ?? ["", "", run.text, ""];
      if (!core) return run.text;
      let out = escapeMarkdown(core);
      if (run.strike) out = `~~${out}~~`;
      if (run.italic) out = `*${out}*`;
      if (run.bold) out = `**${out}**`;
      return `${lead}${out}${trail}`;
    })
    .join("");
}

function markdownBlock(block: JSONContent): string {
  switch (block.type) {
    case "heading":
      return `${"#".repeat(Number(block.attrs?.level ?? 2))} ${markdownInline(block)}`;
    case "bulletList":
      return listItems(block)
        .map((item) => `- ${item.map(markdownBlock).join("\n\n  ")}`)
        .join("\n");
    case "orderedList": {
      const start = Number(block.attrs?.start ?? 1);
      return listItems(block)
        .map((item, i) => `${start + i}. ${item.map(markdownBlock).join("\n\n   ")}`)
        .join("\n");
    }
    case "blockquote":
      return (block.content ?? [])
        .map(markdownBlock)
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "horizontalRule":
      return "* * *";
    case "codeBlock":
      return `\`\`\`\n${inlineText(block)}\n\`\`\``;
    default:
      return markdownInline(block);
  }
}

/** The telling as Markdown. */
export function toMarkdown(blocks: JSONContent[], title = ""): string {
  const parts = [title.trim() ? `# ${escapeMarkdown(title.trim())}` : "", ...blocks.map(markdownBlock)];
  return `${parts.filter((part) => part.trim()).join("\n\n")}\n`;
}

/* ---------- HTML ---------- */

export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlInline(block: JSONContent): string {
  return runsOf(block)
    .map((run) => {
      if ("lineBreak" in run) return "<br>";
      let out = escapeHtmlText(run.text);
      if (run.code) out = `<code>${out}</code>`;
      if (run.strike) out = `<s>${out}</s>`;
      if (run.italic) out = `<em>${out}</em>`;
      if (run.bold) out = `<strong>${out}</strong>`;
      return out;
    })
    .join("");
}

function htmlBlock(block: JSONContent): string {
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(block.attrs?.level ?? 2)));
      return `<h${level}>${htmlInline(block)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${listItems(block)
        .map((item) => `<li>${item.map(htmlBlock).join("")}</li>`)
        .join("")}</ul>`;
    case "orderedList": {
      const start = Number(block.attrs?.start ?? 1);
      return `<ol${start !== 1 ? ` start="${start}"` : ""}>${listItems(block)
        .map((item) => `<li>${item.map(htmlBlock).join("")}</li>`)
        .join("")}</ol>`;
    }
    case "blockquote":
      return `<blockquote>${(block.content ?? []).map(htmlBlock).join("")}</blockquote>`;
    case "horizontalRule":
      return `<p class="scene-break">* * *</p>`;
    case "codeBlock":
      return `<pre><code>${escapeHtmlText(inlineText(block))}</code></pre>`;
    default:
      return `<p>${htmlInline(block)}</p>`;
  }
}

/** The telling's body as HTML (no title), with every bit of text escaped. */
export function toHtml(blocks: JSONContent[]): string {
  return blocks.map(htmlBlock).join("\n");
}

/** A complete HTML page of the telling, for saving or pasting. */
export function toHtmlDocument(blocks: JSONContent[], title = ""): string {
  const heading = title.trim();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtmlText(heading || "Story")}</title>
<style>
body { max-width: 40em; margin: 3em auto; padding: 0 1em; font: 12pt/1.6 Georgia, "Times New Roman", serif; color: #222; }
h1 { text-align: center; margin-bottom: 2em; }
blockquote { margin-left: 2em; }
.scene-break { text-align: center; }
</style>
</head>
<body>
${heading ? `<h1>${escapeHtmlText(heading)}</h1>\n` : ""}${toHtml(blocks)}
</body>
</html>
`;
}

/** A file name stem from the story's title. */
export function fileStem(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "my-story";
}
