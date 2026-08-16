#!/usr/bin/env node
/**
 * 블로그 글(src/content/posts)을 옵시디언 볼트(~/40_Notes/50_Blog)로 백포트.
 * - frontmatter를 볼트 컨벤션으로: publish: true + slug + title/description/tags/publishDate
 * - <PsqlResult .../> 컴포넌트는 마크다운 표로 변환, import 라인 제거
 * - 새 폴더(50_Blog)에만 쓰므로 기존 볼트 노트는 건드리지 않음
 * 실행: node scripts/backport-to-vault.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src/content/posts");
const VAULT = process.env.NOTES_DIR || path.join(os.homedir(), "40_Notes");
const OUT = path.join(VAULT, "50_Blog");

// <PsqlResult .../> → 마크다운 표
function convertPsqlResult(body) {
  return body.replace(/<PsqlResult\b[\s\S]*?\/>/g, block => {
    const pick = re => (block.match(re) || [])[1];
    const db = pick(/\bdb\s*=\s*"([^"]*)"/) || "db";
    const query = pick(/\bquery\s*=\s*"([^"]*)"/);
    const jsonArr = re => {
      const m = block.match(re);
      if (!m) return null;
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    };
    const columns = jsonArr(/\bcolumns\s*=\s*\{(\[[\s\S]*?\])\}/) || [];
    const rows = jsonArr(/\brows\s*=\s*\{(\[[\s\S]*?\])\}/) || [];
    const align = jsonArr(/\balign\s*=\s*\{(\[[\s\S]*?\])\}/) || [];

    let out = "";
    if (query) out += `\`${db}=#\` \`${query}\`\n\n`;
    if (columns.length) {
      out += `| ${columns.join(" | ")} |\n`;
      out += `| ${columns.map((_, i) => (align[i] === "right" ? "---:" : "---")).join(" | ")} |\n`;
      for (const r of rows) out += `| ${r.map(String).join(" | ")} |\n`;
      out += `\n*(${rows.length} row${rows.length === 1 ? "" : "s"})*\n`;
    }
    return out.trimEnd();
  });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(SRC)).filter(f => /\.mdx?$/.test(f));
  let n = 0;
  for (const f of files) {
    const slug = f.replace(/\.mdx?$/, "");
    const parsed = matter(await fs.readFile(path.join(SRC, f), "utf8"));
    const d = parsed.data;

    let body = parsed.content
      .replace(/^\s*import\s+.*$/gm, "") // import 라인 제거
      .replace(/^\s*\n/, ""); // 상단 빈줄 정리
    body = convertPsqlResult(body).replace(/\n{3,}/g, "\n\n").trim();

    const fm = {
      title: d.title,
      description: d.description || "",
      tags: d.tags || [],
      publishDate: (d.pubDatetime instanceof Date
        ? d.pubDatetime
        : new Date(d.pubDatetime || Date.now())
      ).toISOString(),
      publish: true,
      slug,
    };
    if (d.featured) fm.featured = true;

    await fs.writeFile(path.join(OUT, `${slug}.md`), matter.stringify("\n" + body + "\n", fm));
    n++;
  }
  console.log(`[backport] ${n}개 글 → ${OUT}`);
}

main();
