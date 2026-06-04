import Link from "next/link";
import { Article } from "./articles";

function slugToTitle(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function ArticleCTA({ article }: { article: Article }) {
  return (
    <div style={{
      marginTop: 48,
      padding: "28px 32px",
      borderRadius: 16,
      background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
      border: "1px solid rgba(99,102,241,0.25)",
    }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
        Ready to put this into practice?
      </p>
      <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
        Skripr generates retention-optimized YouTube scripts with the exact structural patterns covered in this article.
        {article.cluster.includes("Niche") && " The Niche Bend Engine finds crossover opportunities automatically."}
        {article.cluster.includes("Viral") && " Competitor Video Analysis reverse-engineers any viral video's structure."}
        {article.cluster.includes("Title") && " Viral Magnet Words optimize your titles for maximum CTR."}
        {article.cluster.includes("Retention") && " Every script is engineered for maximum audience retention."}
      </p>
      <Link
        href="/sign-up"
        style={{
          display: "inline-block",
          padding: "12px 28px",
          fontSize: 15,
          fontWeight: 700,
          borderRadius: 12,
          background: "linear-gradient(135deg,#6366f1,#a855f7)",
          color: "#fff",
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
        }}
      >
        Try Skripr Free →
      </Link>
    </div>
  );
}

export function RelatedArticles({ currentSlug, articles }: { currentSlug: string; articles: Article[] }) {
  const related = articles.filter(a => a.slug !== currentSlug).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <div style={{ marginTop: 48 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>
        Related Articles
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {related.map(a => (
          <Link
            key={a.slug}
            href={`/youtube-strategy/${a.slug}`}
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              textDecoration: "none",
              display: "block",
              transition: "border-color 0.2s",
            }}
          >
            <p style={{ fontSize: 13, color: "#818cf8", fontWeight: 600, marginBottom: 6 }}>
              {a.cluster}
            </p>
            <p style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
              {a.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TableOfContents({ content }: { content: string }) {
  const headings = content
    .split("\n")
    .filter(line => line.startsWith("## "))
    .map(line => line.replace("## ", "").trim());

  if (headings.length < 3) return null;

  return (
    <div style={{
      margin: "32px 0",
      padding: "20px 24px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        In this article
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {headings.map((h, i) => (
          <li key={i}>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              {String(i + 1).padStart(2, "0")}. {h}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArticleFAQ({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (faqs.length === 0) return null;

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 20 }}>
        Frequently Asked Questions
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {faqs.map((faq, i) => (
          <div key={i} style={{
            padding: "18px 22px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>
              {faq.q}
            </p>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function renderMarkdown(content: string): string {
  const lines = content.split("\n");
  let html = "";
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith("|") && line.endsWith("|") && line.includes("---")) {
      inTable = true;
      tableHeaders = lines[i - 1].split("|").map(h => h.trim()).filter(Boolean);
      continue;
    }

    if (inTable) {
      if (line.startsWith("|") && line.endsWith("|")) {
        const cells = line.split("|").map(c => c.trim()).filter(Boolean);
        if (cells.length > 0) tableRows.push(cells);
        continue;
      } else {
        // End of table
        html += `<div style="overflow-x:auto;margin:24px 0"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${tableHeaders.map(h => `<th style="padding:10px 14px;text-align:left;background:rgba(99,102,241,0.08);color:#a5b4fc;font-weight:600;border-bottom:1px solid rgba(99,102,241,0.2)">${h}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}">${row.map(cell => `<td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.04)">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>\n`;
        inTable = false;
        tableRows = [];
        tableHeaders = [];
      }
    }

    // Headers
    if (line.startsWith("### ")) {
      html += `<h3 style="font-size:18px;font-weight:700;color:#f1f5f9;margin:32px 0 12px">${line.slice(4)}</h3>\n`;
    } else if (line.startsWith("## ")) {
      html += `<h2 style="font-size:24px;font-weight:800;color:#f1f5f9;margin:40px 0 16px;letter-spacing:-0.02em">${line.slice(3)}</h2>\n`;
    } else if (line.startsWith("- ")) {
      html += `<li style="color:#94a3b8;font-size:14px;line-height:1.8;padding-left:8px">${line.slice(2)}</li>\n`;
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      html += `<li style="color:#94a3b8;font-size:14px;line-height:1.8;padding-left:8px;list-style:decimal">${text}</li>\n`;
    } else if (line.trim() === "") {
      html += "\n";
    } else {
      // Bold inline
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:600">$1</strong>');
      html += `<p style="color:#94a3b8;font-size:15px;line-height:1.85;margin:0 0 16px">${processed}</p>\n`;
    }
  }

  // Close table if file ends during table
  if (inTable && tableHeaders.length > 0) {
    html += `<div style="overflow-x:auto;margin:24px 0"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${tableHeaders.map(h => `<th style="padding:10px 14px;text-align:left;background:rgba(99,102,241,0.08);color:#a5b4fc;font-weight:600;border-bottom:1px solid rgba(99,102,241,0.2)">${h}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}">${row.map(cell => `<td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.04)">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>\n`;
  }

  return html;
}
