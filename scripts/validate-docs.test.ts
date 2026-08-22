import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateDocumentation } from "./validate-docs";

const temporaryDirectories: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pisto-docs-"));
  temporaryDirectories.push(root);
  await mkdir(join(root, "docs"), { recursive: true });
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, "docs", path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

test("accepts valid relative files, anchors, and external URLs", async () => {
  const root = await fixture({
    "README.md":
      "# Index\n\n[Guide](guide.md#safe-heading)\n[Official](https://example.com/docs)\n",
    "guide.md": "# Guide\n\n## Safe heading\n",
  });

  expect(await validateDocumentation(root)).toEqual([]);
});

test("reports missing files and anchors deterministically", async () => {
  const root = await fixture({
    "README.md": "# Index\n\n[Missing](missing.md)\n[Bad anchor](guide.md#absent)\n",
    "guide.md": "# Guide\n",
  });

  const issues = await validateDocumentation(root);
  expect(issues.map((issue) => issue.message)).toEqual([
    "Relative link target does not exist: missing.md",
    "Heading anchor does not exist: guide.md#absent",
  ]);
});

test("reports common encoding corruption", async () => {
  const root = await fixture({ "README.md": "# Index\n\nBroken â”€ tree\n" });

  expect((await validateDocumentation(root))[0]?.message).toContain("encoding corruption");
});
