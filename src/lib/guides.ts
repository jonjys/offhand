import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderMarkdown } from "@/lib/md";

export type Guide = {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  date: string;
  html: string;
  faq: { q: string; a: string }[];
};

const DIR = join(process.cwd(), "content", "guides");

function parse(file: string): Guide {
  const raw = readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`Guide ${file} has no front matter.`);
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const at = line.indexOf(":");
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const body = match[2].trim();
  const faq: Guide["faq"] = [];
  const section = /^## FAQ\s*\n([\s\S]*)$/m.exec(body);
  if (section) {
    for (const entry of section[1].trim().split(/\n\n(?=\*\*)/)) {
      const pair = /^\*\*(.+?)\*\*\s+([\s\S]+)$/.exec(entry.trim());
      if (pair) faq.push({ q: pair[1].trim(), a: pair[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim() });
    }
  }
  return {
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    keyword: meta.keyword,
    date: meta.date,
    html: renderMarkdown(body),
    faq,
  };
}

let cache: Guide[] | undefined;

export function getGuides() {
  cache ??= readdirSync(DIR)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map(parse);
  return cache;
}
