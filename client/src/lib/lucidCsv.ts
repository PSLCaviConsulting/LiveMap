import type { Node, Edge } from "@xyflow/react";

/**
 * Build a CSV string matching Lucidchart's "process diagram from CSV" import
 * schema so a livemap process can be opened directly in Lucidchart.
 *
 * Column order and semantics per Lucid's documented template:
 *   Id                 unique per row (sequential here)
 *   Name               the object TYPE — "Page", "Line", or a shape name
 *                      ("Process" / "Decision" / "Terminator" / "Note")
 *   Shape Library      "Flowchart Shapes" for shapes; blank for Page/Line
 *   Page ID            the Id of the Page row the object lives on
 *   Contained By       container ref (unused here — flat diagram)
 *   Line Source        for a Line row, the Id of the source shape
 *   Line Destination   for a Line row, the Id of the destination shape
 *   Source Arrow       endpoint style: None | Arrow | Open Arrow | Hollow Arrow
 *   Destination Arrow   ″
 *   Text Area 1        page title / shape text / line label
 *   Text Area 2        secondary shape text (System · Role for actions)
 */

const HEADERS = [
  "Id", "Name", "Shape Library", "Page ID", "Contained By",
  "Line Source", "Line Destination", "Source Arrow", "Destination Arrow",
  "Text Area 1", "Text Area 2",
] as const;

const SHAPE_NAME: Record<string, string> = {
  action: "Process",
  question: "Decision",
  start: "Terminator",
  end: "Terminator",
  note: "Note",
};

type Row = Record<(typeof HEADERS)[number], string | number>;

function cell(value: string | number): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function nodeType(n: Node): string {
  return (n.type || (n.data as any)?.nodeType || "action") as string;
}

function nodeText(n: Node): { ta1: string; ta2: string } {
  const d = (n.data ?? {}) as any;
  const type = nodeType(n);
  if (type === "action") {
    const extras = [d.where || d.system, d.role].filter((x: any) => x && String(x).trim());
    return { ta1: (d.what || "").trim(), ta2: extras.map((x: any) => String(x).trim()).join(" · ") };
  }
  if (type === "question") return { ta1: (d.question || d.label || "").trim(), ta2: "" };
  if (type === "start") return { ta1: (d.label || "Start").trim(), ta2: "" };
  if (type === "end") return { ta1: (d.label || "End").trim(), ta2: "" };
  return { ta1: (d.label || d.note || "").trim(), ta2: "" }; // note
}

export function toLucidCsv(nodes: Node[], edges: Edge[], pageTitle = "Process Map"): string {
  const rows: Row[] = [];
  let nextId = 1;

  const blank = (): Row => ({
    Id: 0, Name: "", "Shape Library": "", "Page ID": "", "Contained By": "",
    "Line Source": "", "Line Destination": "", "Source Arrow": "",
    "Destination Arrow": "", "Text Area 1": "", "Text Area 2": "",
  });

  // Page row.
  const pageId = nextId++;
  rows.push({ ...blank(), Id: pageId, Name: "Page", "Text Area 1": pageTitle });

  // Shape rows — map each flow node id to its CSV Id so lines can reference it.
  const idMap = new Map<string, number>();
  for (const n of nodes) {
    const type = nodeType(n);
    if (type === "ghostAction" || type === "ghostQuestion") continue;
    const id = nextId++;
    idMap.set(n.id, id);
    const { ta1, ta2 } = nodeText(n);
    rows.push({
      ...blank(), Id: id, Name: SHAPE_NAME[type] || "Process",
      "Shape Library": "Flowchart Shapes", "Page ID": pageId,
      "Text Area 1": ta1, "Text Area 2": ta2,
    });
  }

  // Line rows.
  for (const e of edges) {
    const s = idMap.get(e.source);
    const t = idMap.get(e.target);
    if (!s || !t) continue;
    rows.push({
      ...blank(), Id: nextId++, Name: "Line", "Page ID": pageId,
      "Line Source": s, "Line Destination": t,
      "Source Arrow": "None", "Destination Arrow": "Arrow",
      "Text Area 1": (e.label as string) || "",
    });
  }

  const lines = [HEADERS.join(",")];
  for (const r of rows) lines.push(HEADERS.map(h => cell(r[h])).join(","));
  return lines.join("\r\n");
}
