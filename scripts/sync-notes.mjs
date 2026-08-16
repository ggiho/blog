#!/usr/bin/env node
/**
 * ~/40_Notes(옵시디언 볼트)에서 `publish: true` 글만 골라
 * AstroPaper 콘텐츠(src/content/posts)로 변환·복사한다.
 *
 * 볼트 frontmatter: publish: true (필수), title/description/tags/publishDate(또는 created) 사용.
 * [[위키링크]]는 텍스트로 풀고, ![[이미지]]는 public/embed로 복사 후 ![](/embed/..)로 변환한다.
 * (표준 마크다운 ![](...)은 그대로 통과 — 파일은 public/에 있어야 함)
 * 실행: node scripts/sync-notes.mjs  (npm run sync)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

const VAULT = process.env.NOTES_DIR || path.join(os.homedir(), "40_Notes");
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/content/posts");
const EMBED_DIR = path.join(ROOT, "public/embed");
const IGNORE = new Set([".obsidian", ".trash", ".git", ".omc", ".omx", "templates", "node_modules"]);
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

const slugify = (s) =>
	s.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
const toDate = (v) => {
	const d = v ? new Date(v) : new Date();
	return isNaN(d) ? new Date() : d;
};
const titleToSlug = (title, file) =>
	slugify((title || path.basename(file, path.extname(file))).replace(/^\d{4}-\d{2}-\d{2}[-\s]*/, ""));
const safeName = (n) => n.replace(/\s+/g, "-");

async function* walk(dir) {
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		if (IGNORE.has(e.name)) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (e.isFile() && /\.mdx?$/.test(e.name)) yield p;
	}
}

// 볼트 전체 이미지 인덱스 (파일명 → 실제 경로). Obsidian 임베드는 파일명으로 참조하므로 basename 키.
async function buildImageIndex(dir, idx = {}) {
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		if (IGNORE.has(e.name)) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) await buildImageIndex(p, idx);
		else if (e.isFile() && IMG_RE.test(e.name)) idx[e.name] = p;
	}
	return idx;
}

// 본문 변환: ![[이미지]]는 복사 대상으로 수집+링크 변환, [[위키링크]]는 텍스트
function processBody(body, imgIndex, toCopy) {
	body = body.replace(/!\[\[([^\]]+?)\]\]/g, (_m, inner) => {
		const [target, alt] = inner.split("|");
		const name = path.basename(target.trim());
		if (!IMG_RE.test(name)) return ""; // 이미지 아닌 임베드(노트 등)는 제거
		const src = imgIndex[name];
		if (!src) return ""; // 볼트에서 못 찾으면 제거
		const safe = safeName(name);
		toCopy.set(safe, src);
		return `![${(alt || "").trim()}](/embed/${encodeURI(safe)})`;
	});
	return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => (a || t).trim());
}

async function main() {
	await fs.mkdir(OUT, { recursive: true });
	// 볼트를 단일 소스로: 기존 생성물을 비우고 다시 채운다 (볼트에서 지우면 blog에서도 사라짐).
	for (const f of await fs.readdir(OUT)) {
		if (/\.mdx?$/.test(f)) await fs.rm(path.join(OUT, f));
	}
	// 임베드 이미지 폴더도 재생성
	await fs.rm(EMBED_DIR, { recursive: true, force: true });
	await fs.mkdir(EMBED_DIR, { recursive: true });

	const imgIndex = await buildImageIndex(VAULT);
	const toCopy = new Map();
	const stats = { scanned: 0, published: 0, skipped: 0, images: 0 };

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
		const dest = path.join(OUT, `${fm.slug || titleToSlug(fm.title, file)}.md`);
		await fs.writeFile(dest, matter.stringify(processBody(parsed.content, imgIndex, toCopy), out));
		stats.published++;
	}

	// 참조된 임베드 이미지 복사
	for (const [safe, src] of toCopy) {
		await fs.copyFile(src, path.join(EMBED_DIR, safe));
		stats.images++;
	}

	console.log(
		`[sync] scanned=${stats.scanned} → posts=${stats.published} (skipped ${stats.skipped}), embed images=${stats.images}`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
