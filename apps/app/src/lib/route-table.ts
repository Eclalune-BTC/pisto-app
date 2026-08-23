/// <reference types="node" />
import { readdirSync } from "node:fs";

const ROUTE_EXTENSION = ".tsx";
const INDEX_BASENAME = "index";
const LAYOUT_BASENAME = "_layout";
const SPECIAL_BASENAMES: readonly string[] = ["+html", "+not-found"];

const GROUP_SEGMENT = /^\([a-z][a-z0-9-]*\)$/;
const DYNAMIC_SEGMENT = /^\[[a-z][A-Za-z0-9]*\]$/;
const STATIC_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type RouteConflict = {
  readonly files: readonly string[];
  readonly url: string;
};

export type RouteTable = {
  readonly conflicts: readonly RouteConflict[];
  readonly layouts: readonly string[];
  readonly specials: readonly string[];
  readonly urls: readonly string[];
};

function readBasename(file: string): string {
  if (!file.endsWith(ROUTE_EXTENSION)) {
    throw new Error(`Route file "${file}" does not end in "${ROUTE_EXTENSION}".`);
  }

  return file.slice(file.lastIndexOf("/") + 1, -ROUTE_EXTENSION.length);
}

function assertDirectory(file: string, segment: string): void {
  if (
    GROUP_SEGMENT.test(segment) ||
    DYNAMIC_SEGMENT.test(segment) ||
    STATIC_SEGMENT.test(segment)
  ) {
    return;
  }

  throw new Error(`Route file "${file}" uses an unmodelled directory segment "${segment}".`);
}

function assertRouteBasename(file: string, basename: string): void {
  if (DYNAMIC_SEGMENT.test(basename) || STATIC_SEGMENT.test(basename)) return;

  throw new Error(`Route file "${file}" uses an unmodelled file name "${basename}".`);
}

function toUrl(directories: readonly string[], basename: string): string {
  const segments = directories.filter((segment) => !GROUP_SEGMENT.test(segment));

  if (basename !== INDEX_BASENAME) segments.push(basename);

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/**
 * Models only the four Expo Router conventions this route tree uses: group directories,
 * `index` files, `[param]` segments, and the `_layout`/`+html`/`+not-found` special files.
 * Anything else throws so an unmodelled convention cannot pass as a known URL.
 */
export function buildRouteTable(files: readonly string[]): RouteTable {
  const owners = new Map<string, string[]>();
  const layouts: string[] = [];
  const specials: string[] = [];

  for (const file of [...files].sort()) {
    const segments = file.split("/");
    const basename = readBasename(file);

    for (const segment of segments.slice(0, -1)) assertDirectory(file, segment);

    if (basename === LAYOUT_BASENAME) {
      layouts.push(file);
      continue;
    }

    if (basename.startsWith("+")) {
      if (!SPECIAL_BASENAMES.includes(basename)) {
        throw new Error(`Route file "${file}" uses an unmodelled special file "${basename}".`);
      }

      specials.push(file);
      continue;
    }

    assertRouteBasename(file, basename);

    const url = toUrl(segments.slice(0, -1), basename);
    const owner = owners.get(url);

    if (owner) owner.push(file);
    else owners.set(url, [file]);
  }

  const conflicts = [...owners]
    .filter(([, owned]) => owned.length > 1)
    .map(([url, owned]): RouteConflict => ({ files: owned, url }));

  return {
    conflicts,
    layouts,
    specials,
    urls: [...owners.keys()].sort(),
  };
}

/**
 * Reads source files, so only tests may import it; the running app never bundles this module.
 */
export function readRouteFiles(directory: string, prefix = ""): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? readRouteFiles(`${directory}/${entry.name}`, `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    )
    .sort();
}
