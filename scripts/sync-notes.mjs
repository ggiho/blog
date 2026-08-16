#!/usr/bin/env node
/**
 * ~/40_Notes(옵시디언 볼트)에서 `publish: true` 글만 골라
 * AstroPaper 콘텐츠(src/content/posts)로 변환·복사한다.
 *
 * 볼트 frontmatter: publish: true (필수), title/description/tags/publishDate(또는 created) 사용.
 * 순수 블로그라 [[위키링크]]는 텍스트로 풀고, ![[이미지]]는 제거.
 * 실행: node scripts/sync-notes.mjs  (npm run sync)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

const VAULT = process.env.NOTES_DIR || path.join(os.homedir(), "40_Notes");
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/content/posts");
const IGNORE = new Set([".obsidian", ".trash", ".git", ".omc", ".omx", "templates", "node_modules"]);

const slugify = (s) =>
	s.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
const toDate = (v) => {
	const d = v ? new Date(v) : new Date();
	return isNaN(d) ? new Date() : d;
};
const titleToSlug = (title, file) =>
	slugify((title || path.basename(file, path.extname(file))).replace(/^\d{4}-\d{2}-\d{2}[-\s]*/, ""));

async function* walk(dir) {
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		if (IGNORE.has(e.name)) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (e.isFile() && /\.mdx?$/.test(e.name)) yield p;
	}
}

function stripWiki(body) {
	body = body.replace(/!\[\[[^\]]+\]\]/g, ""); // 이미지 임베드 제거
	return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => (a || t).trim());
}

async function main() {
	await fs.mkdir(OUT, { recursive: true });
	const stats = { scanned: 0, published: 0, skipped: 0 };
	for await (const file of walk(VAULT)) {
		stats.scanned++;
		let parsed;
		try {
			parsed = matter(await fs.readFile(file, "utf8"));
		} catch {
			continue;
		}
		const fm = parsed.data || {};
		if (fm.publish !== true) {
			stats.skipped++;
			continue;
		}
		const title = (fm.title || path.basename(file, path.extname(file))).slice(0, 120);
		const out = {
			title,
			description: fm.description || title,
			pubDatetime: toDate(fm.publishDate || fm.pubDatetime || fm.created || fm.date),
			tags: Array.isArray(fm.tags) && fm.tags.length ? fm.tags : ["others"],
			...(fm.updatedDate || fm.modDatetime
				? { modDatetime: toDate(fm.updatedDate || fm.modDatetime) }
				: {}),
			...(fm.featured ? { featured: true } : {}),
		};
		// slug frontmatter가 있으면 그대로(블로그 파일명 1:1 매핑), 없으면 제목에서 생성
		const dest = path.join(OUT, `${fm.slug || titleToSlug(fm.title, file)}.md`);
		await fs.writeFile(dest, matter.stringify(stripWiki(parsed.content), out));
		stats.published++;
	}
	console.log(`[sync] scanned=${stats.scanned} → posts=${stats.published} (skipped ${stats.skipped})`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
