// A tiny, safe text format for content pages. It produces React elements, never
// raw HTML, so nothing typed in the admin can inject scripts.
//
//   ## Heading         → <h2>        ### Heading → <h3>
//   - item             → bullet list
//   1. item            → numbered list
//   **bold**           → <strong>
//   [text](/path)      → link (only /internal paths, https:// or tel:/mailto:)
//   blank line         → new paragraph
import type { ReactNode } from "react";

const SAFE_HREF = /^(\/[\w\-/#?=&.%]*|https:\/\/[\w.-]+(\/\S*)?|tel:\+?\d{6,15}|mailto:[^\s@]+@[^\s@]+)$/;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else if (SAFE_HREF.test(m[3])) out.push(<a key={`${keyBase}-a${i++}`} href={m[3]} {...(m[3].startsWith("https://") ? { target: "_blank", rel: "noopener" } : {})}>{m[2]}</a>);
    else out.push(m[2]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markup({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").map((l) => l.trim());
        if (lines[0].startsWith("### ")) return <h3 key={i}>{inline(lines[0].slice(4), `h${i}`)}</h3>;
        if (lines[0].startsWith("## ")) return <h2 key={i}>{inline(lines[0].slice(3), `h${i}`)}</h2>;
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `u${i}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+[.)] /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)] /, ""), `o${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{lines.flatMap((l, j) => (j ? [<br key={`br${j}`} />, ...inline(l, `p${i}-${j}`)] : inline(l, `p${i}-${j}`)))}</p>;
      })}
    </>
  );
}

/** Plain text (for meta descriptions and JSON-LD). */
export function plainText(text: string, max = 160): string {
  const s = text.replace(/[#*[\]()>-]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
