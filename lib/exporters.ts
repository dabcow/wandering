"use client";

/**
 * Download a telling of the story as a file. The Word and PDF libraries are
 * large, so they load only when an export is asked for.
 */
import type { JSONContent } from "@tiptap/core";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { fileStem, runsOf, toHtmlDocument, toMarkdown, toPlainText, type Run } from "./manuscript";

export type ExportFormat = "docx" | "pdf" | "md" | "txt" | "html";

/** Hand a file to the browser to save. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before letting go of the data.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const listItems = (list: JSONContent) => (list.content ?? []).map((item) => item.content ?? []);

/* ---------- Word ---------- */

async function docxBlob(blocks: JSONContent[], title: string): Promise<Blob> {
  const docx = await import("docx");
  const { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } = docx;

  const runs = (block: JSONContent, extra: { italics?: boolean } = {}) =>
    runsOf(block).map((run: Run) =>
      "lineBreak" in run
        ? new TextRun({ text: "", break: 1 })
        : new TextRun({
            text: run.text,
            bold: run.bold,
            italics: run.italic || extra.italics,
            strike: run.strike,
            font: run.code ? "Courier New" : undefined,
          }),
    );

  let listInstance = 0;
  const paragraphs = (block: JSONContent, indent = 0): InstanceType<typeof Paragraph>[] => {
    const indentOpt = indent ? { indent: { left: indent } } : {};
    switch (block.type) {
      case "heading":
        return [
          new Paragraph({
            heading: Number(block.attrs?.level) === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2,
            children: runs(block),
            ...indentOpt,
          }),
        ];
      case "bulletList":
        return listItems(block).flatMap((item) =>
          item.flatMap((child, i) =>
            i === 0 && child.type === "paragraph"
              ? [new Paragraph({ children: runs(child), bullet: { level: 0 } })]
              : paragraphs(child, 720),
          ),
        );
      case "orderedList": {
        const instance = ++listInstance;
        return listItems(block).flatMap((item) =>
          item.flatMap((child, i) =>
            i === 0 && child.type === "paragraph"
              ? [new Paragraph({ children: runs(child), numbering: { reference: "ordered", level: 0, instance } })]
              : paragraphs(child, 720),
          ),
        );
      }
      case "blockquote":
        return (block.content ?? []).flatMap((child) => paragraphs(child, indent + 720));
      case "horizontalRule":
        return [new Paragraph({ text: "*   *   *", alignment: AlignmentType.CENTER })];
      default:
        return [new Paragraph({ children: runs(block), ...indentOpt })];
    }
  };

  const heading = title.trim();
  const doc = new Document({
    title: heading || undefined,
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
          paragraph: { spacing: { after: 200, line: 360 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        // US Letter with one-inch margins, like a Google Doc.
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          ...(heading ? [new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, text: heading })] : []),
          ...blocks.flatMap((block) => paragraphs(block)),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

/* ---------- PDF ---------- */

async function pdfBlob(blocks: JSONContent[], title: string): Promise<Blob> {
  const pdfModule = await import("pdfmake/build/pdfmake");
  const pdfMake = (pdfModule as unknown as { default?: typeof pdfModule }).default ?? pdfModule;
  // Times is one of the PDF standard fonts: no font files to embed.
  const times = await import("pdfmake/build/standard-fonts/Times");
  pdfMake.addFontContainer((times as unknown as { default?: unknown }).default ?? times);

  const inline = (block: JSONContent) =>
    runsOf(block).map((run) =>
      "lineBreak" in run
        ? { text: "\n" }
        : {
            text: run.text,
            bold: run.bold,
            italics: run.italic,
            decoration: run.strike ? ("lineThrough" as const) : undefined,
          },
    );

  const content = (block: JSONContent): Content => {
    switch (block.type) {
      case "heading":
        return { text: inline(block), style: Number(block.attrs?.level) === 3 ? "h3" : "h2" };
      case "bulletList":
        return { ul: listItems(block).map((item) => ({ stack: item.map(content) })), margin: [0, 0, 0, 10] };
      case "orderedList":
        return {
          ol: listItems(block).map((item) => ({ stack: item.map(content) })),
          start: Number(block.attrs?.start ?? 1),
          margin: [0, 0, 0, 10],
        };
      case "blockquote":
        return { stack: (block.content ?? []).map(content), margin: [36, 0, 0, 0] };
      case "horizontalRule":
        return { text: "*   *   *", alignment: "center", margin: [0, 4, 0, 14] };
      default:
        return { text: inline(block), margin: [0, 0, 0, 10] };
    }
  };

  const heading = title.trim();
  const definition: TDocumentDefinitions = {
    info: { title: heading || "Story" },
    pageSize: "LETTER",
    // One-inch margins, like a Google Doc.
    pageMargins: 72,
    defaultStyle: { font: "Times", fontSize: 12, lineHeight: 1.35 },
    styles: {
      title: { fontSize: 22, alignment: "center", margin: [0, 0, 0, 24] },
      h2: { fontSize: 16, bold: true, margin: [0, 8, 0, 8] },
      h3: { fontSize: 13, bold: true, margin: [0, 6, 0, 6] },
    },
    content: [...(heading ? [{ text: heading, style: "title" }] : []), ...blocks.map(content)],
  };
  return pdfMake.createPdf(definition).getBlob();
}

/* ---------- Any format ---------- */

const TEXT_TYPES: Record<Exclude<ExportFormat, "docx" | "pdf">, string> = {
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
};

/** Build the telling in a format and download it. Throws if the file could not be made. */
export async function exportTelling(format: ExportFormat, blocks: JSONContent[], title: string) {
  const name = `${fileStem(title)}.${format}`;
  if (format === "docx") return downloadBlob(await docxBlob(blocks, title), name);
  if (format === "pdf") return downloadBlob(await pdfBlob(blocks, title), name);
  const text =
    format === "md" ? toMarkdown(blocks, title) : format === "txt" ? toPlainText(blocks, title) : toHtmlDocument(blocks, title);
  downloadBlob(new Blob([text], { type: TEXT_TYPES[format] }), name);
}
