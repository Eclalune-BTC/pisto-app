// Serves an Expo single-page web export: existing files as-is, every other path as index.html so
// client-side routes survive a reload. Usage: bun scripts/serve-web.ts <dir> <port>
import { stat } from "node:fs/promises";
import { join, normalize } from "node:path";

const [dir, portArgument] = process.argv.slice(2);
const port = Number(portArgument);
if (!dir || !Number.isInteger(port)) {
  throw new Error("Usage: bun scripts/serve-web.ts <dir> <port>");
}
const root = normalize(dir);
const index = Bun.file(join(root, "index.html"));
if (!(await index.exists())) throw new Error(`${join(root, "index.html")} does not exist`);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const path = normalize(join(root, decodeURIComponent(new URL(request.url).pathname)));
    const isFile = path.startsWith(root) && (await stat(path).catch(() => null))?.isFile();
    if (isFile) return new Response(Bun.file(path));
    return new Response(index, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
});
console.info(`Serving ${root} on http://127.0.0.1:${port}`);
