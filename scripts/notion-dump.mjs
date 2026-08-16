// 지정한 노트들의 내용을 마크다운으로 stdout 덤프 (읽기용, 파일 생성 X)
const NOTION = "https://www.notion.so";
const IDS = process.argv.slice(2);
const unwrap = e => { let v = e?.value ?? e; while (v && v.value && (v.role || v.spaceId) && !v.type) v = v.value; return v; };
const rich = a => Array.isArray(a) ? a.map(s => {
  let t = s[0] ?? ""; const f = s[1] || [];
  if (f.some(x => x[0] === "c")) t = "`" + t + "`";
  const link = f.find(x => x[0] === "a"); if (link) t = `[${t}](${link[1]})`;
  return t;
}).join("") : "";

async function fetchBlocks(id) {
  const res = await fetch(NOTION + "/api/v3/loadPageChunk", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ pageId: id, limit: 200, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
  });
  const d = await res.json();
  const b = {};
  for (const [k, e] of Object.entries(d.recordMap.block || {})) b[k] = unwrap(e);
  return b;
}
function walk(id, blocks, depth = 0) {
  const b = blocks[id]; if (!b) return "";
  const t = rich(b.properties?.title); const pad = "  ".repeat(depth);
  let s = "";
  switch (b.type) {
    case "page": break;
    case "header": s = `\n## ${t}\n`; break;
    case "sub_header": s = `\n### ${t}\n`; break;
    case "sub_sub_header": s = `\n#### ${t}\n`; break;
    case "bulleted_list": case "bulleted_list_item": s = `${pad}- ${t}\n`; break;
    case "numbered_list": case "numbered_list_item": s = `${pad}1. ${t}\n`; break;
    case "code": s = `\n\`\`\`${(b.properties?.language?.[0]?.[0]||"").toLowerCase()}\n${(b.properties?.title||[]).map(x=>x[0]).join("")}\n\`\`\`\n`; break;
    case "quote": s = `> ${t}\n`; break;
    case "callout": s = `> ${t}\n`; break;
    case "image": s = `[image]\n`; break;
    case "divider": s = `---\n`; break;
    default: s = t ? `${t}\n` : "";
  }
  for (const c of b.content || []) s += walk(c, blocks, depth + 1);
  return s;
}
for (const id of IDS) {
  const blocks = await fetchBlocks(id);
  const page = blocks[id];
  console.log(`\n\n========== ${rich(page?.properties?.title)} ==========`);
  for (const c of page?.content || []) process.stdout.write(walk(c, blocks));
}
