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
  // 2차 이전 (추천 13)
  { id: "2c9e8840-7025-4da7-9f37-332286620d6a", slug: "mysql-5-7-orphan-table", tags: ["mysql", "troubleshooting", "database"] },
  { id: "b4998a03-c20c-4ddc-8e26-793d6330d2f4", slug: "mysql-system-variables", tags: ["mysql", "database"] },
  { id: "8f35ff57-563e-4020-abce-4aeaa14a8aeb", slug: "sql-server-getting-started", tags: ["sql-server", "database"] },
  { id: "1143d039-df65-808a-bd1a-dd40b5f1e8ff", slug: "compile-c-cpp-on-mac", tags: ["c", "cpp", "macos"] },
  { id: "9bdb3323-e2f5-4dbf-a668-39c086d499fd", slug: "mysql-monitoring", tags: ["mysql", "monitoring", "database"] },
  { id: "2ef3d039-df65-8022-8964-efe617bd70e8", slug: "mac-setup-flow", tags: ["macos", "setup", "tools"] },
  { id: "6db31c83-c425-4a4c-85e6-3e2d509f0abb", slug: "minikube-podman", tags: ["kubernetes", "podman", "tools"] },
  { id: "8283f7d4-1d82-4458-8c1a-7a0456404431", slug: "mysql-uuid", tags: ["mysql", "database"] },
  { id: "ae8c774e-dbdb-434b-ad72-c7e8437ed9f8", slug: "mysql-reset-account", tags: ["mysql", "database"] },
  { id: "4c6776f1-af59-4ec8-9053-a3e6687dcf6e", slug: "mysql-rsa-public-key-error", tags: ["mysql", "troubleshooting"] },
  { id: "10b3d039-df65-8070-996a-f6b037a69612", slug: "rds-start-export-task", tags: ["aws", "rds", "data-engineering"] },
  { id: "547f8f54-f5ad-469d-b8f4-b71d6ce18086", slug: "mysql-export-data-file", tags: ["mysql", "data-engineering"] },
  { id: "ebf6245b-118a-4188-8fb8-7aa2cdb68e69", slug: "cross-db-link-python", tags: ["python", "database", "data-engineering"] },
  // 2차 이전 (선택 5)
  { id: "6cbcd062-dc2b-4108-bee6-4020f04d09bb", slug: "sql-server-isolation-levels", tags: ["sql-server", "database", "transaction"] },
  { id: "37292e30-6313-4e31-be26-9b27eaeedd83", slug: "mysql-json-column", tags: ["mysql", "database"] },
  { id: "d4e8652a-dce5-4e62-900a-4914b09cdce5", slug: "selenium-crawling-tips", tags: ["python", "selenium", "crawling"] },
  { id: "10a3d039-df65-8082-8ba8-ff4b156ea687", slug: "airflow-tutorial", tags: ["airflow", "data-engineering"] },
  { id: "eff124ea-9d18-46b0-9f54-5dfb688c0fec", slug: "mysql-perf-monitoring", tags: ["mysql", "monitoring", "database"] },
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
