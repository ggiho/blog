// Notion 공개 페이지 → Astro 마크다운 변환기 (일회성 이전용)
// 사용: node scripts/notion-import.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/content/posts");
const REVIEW = path.join(ROOT, "scripts/_notion_review");
const IMG_DIR = path.join(ROOT, "public/notion");
const NOTION = "https://giho.notion.site";

// 민감정보 필터 (걸리면 발행 대신 review 폴더로)
// 실제 회사/PII/키만 잡음 (예시 --password=pw 같은 플레이스홀더는 제외)
const SENSITIVE = /asurion|어슈리온|\bskt\b|쿼리파이|queryfi|dbfence|주민등록|계좌번호|리니지|AKIA[0-9A-Z]{12,}|-----BEGIN|xoxb-|ghp_[A-Za-z0-9]{20,}/i;

const TARGETS = [
  { id: "2503d039-df65-8018-bdbc-d211eb74d059", slug: "mysql-adaptive-hash-index", tags: ["mysql", "database", "internals"] },
  { id: "35d3d039-df65-8147-b627-cbd48a21c1a1", slug: "mysql-online-ddl", tags: ["mysql", "database", "ddl"] },
  { id: "35d3d039-df65-8154-bcd4-d5458279fc69", slug: "mysql-collation", tags: ["mysql", "database"] },
  { id: "6e236561-78bf-4897-a940-46d8e458acdd", slug: "mysql-replication", tags: ["mysql", "replication", "database"] },
  { id: "e066cf30-ab60-49e1-8f15-563048a540d1", slug: "mysql-backup-recovery", tags: ["mysql", "backup", "database"] },
  { id: "892feacc-10b9-4ec7-bb44-ba1716753b12", slug: "index-scan-process", tags: ["mysql", "index", "database"] },
  { id: "43a4d2f5-df3f-4fea-bd1e-da8e4d7e3f4b", slug: "rowid-filter", tags: ["mysql", "index", "optimizer"] },
  { id: "35d3d039-df65-819e-841b-c29ea15064e4", slug: "aurora-mysql-architecture", tags: ["aurora", "mysql", "aws"] },
  { id: "24e3d039-df65-8021-9a92-c714e9cc50ca", slug: "aurora-3-10-jemalloc", tags: ["aurora", "mysql", "aws"] },
  { id: "25e3d039-df65-8074-8ec5-d60e6b3823fb", slug: "aurora-dsql", tags: ["aurora", "aws", "distributed"] },
  { id: "2303d039-df65-809a-b43a-f6126f4c4264", slug: "cap-theorem", tags: ["distributed", "theory"] },
  { id: "25e3d039-df65-8069-9786-fb284390aed3", slug: "pcc-vs-occ", tags: ["database", "concurrency", "theory"] },
  { id: "35d3d039-df65-8122-9038-f467ad7a3c7a", slug: "dynamodb-ai-chat-modeling", tags: ["dynamodb", "nosql", "aws"] },
  { id: "3db18648-ede9-4542-80d7-d791e02c16f6", slug: "duckdb", tags: ["duckdb", "data-engineering"] },
  { id: "35d3d039-df65-8149-9fcd-d07845820aa7", slug: "aws-dms-gotchas", tags: ["dms", "aws", "data-engineering"] },
  { id: "35d3d039-df65-8100-90e0-d4ae5095fe49", slug: "airflow-cfg-options", tags: ["airflow", "data-engineering"] },
  { id: "bd2c07e1-7b52-4ba8-ac67-8d45d875f49f", slug: "dolphie-mysql-monitoring", tags: ["mysql", "monitoring", "tools"] },
  { id: "23e3d039-df65-80fc-a8d3-c522fa3eb32c", slug: "schema-diff-pro", tags: ["mysql", "tools"] },
  { id: "2653d039-df65-8082-ba55-e4725d009cf3", slug: "mongodb-local-2025", tags: ["mongodb", "conference"] },
  { id: "2523d039-df65-800e-9151-f88a51cb98a8", slug: "pycon-korea-2025", tags: ["python", "conference"] },
];

const post = async (url, body) => {
  const res = await fetch(NOTION + url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
};

// 블록 접근 정규화 (loadPageChunk / queryCollection 중첩 차이 흡수)
const unwrap = entry => {
  let v = entry?.value ?? entry;
  while (v && v.value && (v.role || v.spaceId) && !v.type) v = v.value;
  return v;
};

async function fetchPageBlocks(pageId) {
  const blocks = {};
  let cursor = { stack: [] };
  let guard = 0;
  do {
    const data = await post("/api/v3/loadPageChunk", {
      pageId,
      limit: 100,
      cursor,
      chunkNumber: 0,
      verticalColumns: false,
    });
    for (const [id, entry] of Object.entries(data.recordMap.block || {})) {
      blocks[id] = unwrap(entry);
    }
    cursor = data.cursor && data.cursor.stack && data.cursor.stack.length ? data.cursor : null;
  } while (cursor && ++guard < 20);
  return blocks;
}

// 리치텍스트 → 마크다운
function rich(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .map(seg => {
      let t = seg[0] ?? "";
      if (t === "⁍") return ""; // inline equation placeholder
      const fmts = seg[1] || [];
      let link = null;
      let code = false;
      const wrap = [];
      for (const f of fmts) {
        switch (f[0]) {
          case "b": wrap.push("**"); break;
          case "i": wrap.push("_"); break;
          case "s": wrap.push("~~"); break;
          case "c": code = true; break;
          case "a": link = f[1]; break;
        }
      }
      // ChatGPT 인용 스팸 링크 제거 (텍스트도 쓰레기라 통째로 버림)
      if (link && /utm_source=chatgpt\.com/i.test(link)) return "";
      if (code) t = "`" + t + "`";
      else for (const w of wrap) t = w + t + w;
      if (link) t = `[${t}](${link})`;
      return t;
    })
    .join("");
}

const CALLOUT = { "💡": "tip", "⚠️": "warning", "❗": "important", "🔥": "danger", "📌": "note", "ℹ️": "note", "✅": "success" };

async function downloadImage(block, slug, idx) {
  const src = block.properties?.source?.[0]?.[0] || block.format?.display_source;
  if (!src) return null;
  const proxied = src.startsWith("http")
    ? `${NOTION}/image/${encodeURIComponent(src)}?table=block&id=${block.id}&cache=v2`
    : src;
  try {
    const res = await fetch(proxied, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : ct.includes("svg") ? "svg" : ct.includes("webp") ? "webp" : "jpg";
    const dir = path.join(IMG_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const name = `img-${idx}.${ext}`;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), buf);
    return `/notion/${slug}/${name}`;
  } catch {
    return null;
  }
}

async function blockToMd(id, blocks, slug, ctx, depth = 0) {
  const b = blocks[id];
  if (!b || b.type === "page") return "";
  const pad = "  ".repeat(depth);
  const txt = rich(b.properties?.title);
  const kids = async () => {
    let out = "";
    for (const c of b.content || []) out += await blockToMd(c, blocks, slug, ctx, depth + 1);
    return out;
  };
  let md = "";
  switch (b.type) {
    case "header": md = `\n## ${txt}\n\n`; break;
    case "sub_header": md = `\n### ${txt}\n\n`; break;
    case "sub_sub_header": md = `\n#### ${txt}\n\n`; break;
    case "text": md = txt.trim() ? `${pad}${txt}\n\n` : "\n"; break;
    case "bulleted_list": case "bulleted_list_item":
      md = `${pad}- ${txt}\n` + (await kids()); break;
    case "numbered_list": case "numbered_list_item":
      md = `${pad}1. ${txt}\n` + (await kids()); break;
    case "to_do":
      md = `${pad}- [${b.properties?.checked?.[0]?.[0] === "Yes" ? "x" : " "}] ${txt}\n`; break;
    case "toggle":
      md = `\n<details>\n<summary>${txt}</summary>\n\n` + (await kids()) + `\n</details>\n\n`; break;
    case "quote": md = `> ${txt}\n\n`; break;
    case "callout": {
      const emoji = b.format?.page_icon || "📌";
      const kind = CALLOUT[emoji] || "note";
      const body = txt.split("\n").map(l => `> ${l}`).join("\n");
      md = `\n> [!${kind}]\n${body}\n\n`; break;
    }
    case "code": {
      const lang = (b.properties?.language?.[0]?.[0] || "").toLowerCase().replace(/\s+/g, "");
      const codeText = (b.properties?.title || []).map(s => s[0]).join("");
      md = `\n\`\`\`${lang || ""}\n${codeText}\n\`\`\`\n\n`; break;
    }
    case "divider": md = `\n---\n\n`; break;
    case "image": {
      const p = await downloadImage(b, slug, ctx.img++);
      const cap = rich(b.properties?.caption);
      if (p) md = `\n![${cap || ""}](${p})\n\n`;
      break;
    }
    case "bookmark": {
      const url = b.properties?.link?.[0]?.[0];
      if (url) md = `[${txt || url}](${url})\n\n`;
      break;
    }
    case "equation":
      md = `\n$$\n${(b.properties?.title || []).map(s => s[0]).join("")}\n$$\n\n`; break;
    case "column_list": case "column":
      md = await kids(); break;
    default:
      md = txt ? `${txt}\n\n` : (await kids());
  }
  return md;
}

const fm = v => (/[:#"'\[\]{}]|^\s|\s$/.test(v) ? JSON.stringify(v) : v);

async function main() {
  fs.mkdirSync(REVIEW, { recursive: true });
  const summary = [];
  for (const t of TARGETS) {
    try {
      const blocks = await fetchPageBlocks(t.id);
      const page = blocks[t.id];
      if (!page) { summary.push([t.slug, "SKIP", "page not found"]); continue; }
      const title = rich(page.properties?.title) || t.slug;
      const created = page.created_time ? new Date(page.created_time).toISOString() : new Date().toISOString();
      const ctx = { img: 1 };
      let body = "";
      for (const c of page.content || []) body += await blockToMd(c, blocks, t.slug, ctx);
      body = body.replace(/\n{3,}/g, "\n\n").trim();

      const plain = body.replace(/[#>*`_\-\[\]!]/g, " ").replace(/\s+/g, " ").trim();
      if (plain.length < 80) { summary.push([t.slug, "SKIP", `stub (${plain.length} chars)`]); continue; }

      const sensitive = SENSITIVE.test(title + "\n" + body);
      // description: 이모지 제거 + "Introduction" 헤더 스킵 + 단어 경계에서 컷
      const clean = plain
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, "")
        .replace(/\s+/g, " ")
        .replace(/^Introduction\s*/i, "")
        .trim();
      let desc = clean.slice(0, 120);
      if (clean.length > 120) desc = desc.replace(/\s+\S*$/, "") + "…";
      const frontmatter = [
        "---",
        `title: ${fm(title)}`,
        `description: ${fm(desc)}`,
        `pubDatetime: ${created}`,
        "tags:",
        ...t.tags.map(x => `  - ${x}`),
        "---",
        "",
      ].join("\n");
      const out = frontmatter + body + "\n";
      const dest = sensitive ? path.join(REVIEW, `${t.slug}.md`) : path.join(OUT, `${t.slug}.md`);
      fs.writeFileSync(dest, out);
      summary.push([t.slug, sensitive ? "REVIEW" : "OK", `${plain.length} chars, imgs:${ctx.img - 1}`]);
    } catch (e) {
      summary.push([t.slug, "ERROR", e.message]);
    }
  }
  console.log("\n=== import summary ===");
  for (const [s, st, n] of summary) console.log(`${st.padEnd(7)} ${s.padEnd(30)} ${n}`);
}

main();
