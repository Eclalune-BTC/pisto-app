#!/usr/bin/env bun

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");

export interface DocumentationIssue {
  file: string;
  line: number;
  message: string;
}

interface MarkdownLink {
  destination: string;
  line: number;
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(path);
      }
      return extname(entry.name).toLowerCase() === ".md" ? [path] : [];
    }),
  );
  return files.flat().sort();
}

function stripCodeFences(contents: string): string {
  let inFence = false;
  return contents
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

function extractLinks(contents: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const source = stripCodeFences(contents);
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match = pattern.exec(source);

  while (match !== null) {
    let destination = match[1].trim();
    if (destination.startsWith("<") && destination.endsWith(">")) {
      destination = destination.slice(1, -1);
    } else {
      destination = destination.split(/\s+["']/)[0];
    }
    const line = source.slice(0, match.index).split("\n").length;
    links.push({ destination, line });
    match = pattern.exec(source);
  }

  return links;
}

function githubSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function headingAnchors(contents: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  let inFence = false;

  for (const line of contents.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const base = githubSlug(match[1]);
    const count = counts.get(base) ?? 0;
    const anchor = count === 0 ? base : `${base}-${count}`;
    counts.set(base, count + 1);
    anchors.add(anchor);
  }

  return anchors;
}

async function pathIsFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function splitDestination(destination: string): { anchor: string; path: string } {
  const hash = destination.indexOf("#");
  if (hash === -1) return { anchor: "", path: destination };
  return {
    anchor: decodeURIComponent(destination.slice(hash + 1)),
    path: destination.slice(0, hash),
  };
}

function externalUrlIssue(destination: string): string | null {
  try {
    const url = new URL(destination);
    if (!url.hostname) return "External URL has no hostname.";
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return `Unsupported external URL protocol: ${url.protocol}`;
    }
    return null;
  } catch {
    return "External URL is not syntactically valid.";
  }
}

export async function validateDocumentation(root = PROJECT_ROOT): Promise<DocumentationIssue[]> {
  const absoluteRoot = resolve(root);
  const docsRoot = join(absoluteRoot, "docs");
  const files = await listMarkdownFiles(docsRoot);
  const issues: DocumentationIssue[] = [];
  const contentsByFile = new Map<string, string>();

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    contentsByFile.set(file, contents);
    const shownFile = relative(absoluteRoot, file).replaceAll("\\", "/");

    for (const marker of ["\uFFFD", "â”", "â€“", "â€™"]) {
      const index = contents.indexOf(marker);
      if (index >= 0) {
        issues.push({
          file: shownFile,
          line: contents.slice(0, index).split(/\r?\n/).length,
          message: `Possible encoding corruption contains ${JSON.stringify(marker)}.`,
        });
      }
    }

    for (const link of extractLinks(contents)) {
      const destination = link.destination;
      if (!destination || destination.startsWith("mailto:")) continue;

      if (/^https?:/i.test(destination)) {
        const message = externalUrlIssue(destination);
        if (message) issues.push({ file: shownFile, line: link.line, message });
        continue;
      }

      const target = splitDestination(destination);
      let targetFile = target.path ? resolve(dirname(file), target.path) : file;
      if (await pathIsFile(join(targetFile, "README.md"))) {
        targetFile = join(targetFile, "README.md");
      }

      if (!(await pathIsFile(targetFile))) {
        issues.push({
          file: shownFile,
          line: link.line,
          message: `Relative link target does not exist: ${destination}`,
        });
        continue;
      }

      if (target.anchor) {
        const targetContents =
          contentsByFile.get(targetFile) ?? (await readFile(targetFile, "utf8"));
        contentsByFile.set(targetFile, targetContents);
        if (!headingAnchors(targetContents).has(target.anchor)) {
          issues.push({
            file: shownFile,
            line: link.line,
            message: `Heading anchor does not exist: ${destination}`,
          });
        }
      }
    }
  }

  return issues.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.message.localeCompare(right.message),
  );
}

async function main(): Promise<number> {
  const issues = await validateDocumentation();
  if (issues.length > 0) {
    console.error(`Documentation validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue.file}:${issue.line} ${issue.message}`);
    }
    return 1;
  }

  console.log(
    "Documentation validation passed: relative links, anchors, URLs, and encoding look valid.",
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main();
}
