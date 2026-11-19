/** The part of the Workers assets binding this module uses. */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

type ByteRange = { start: number; end: number } | "unsatisfiable" | "ignored";

/** One `bytes=` range against a body of `size` bytes; several ranges or another unit are ignored. */
function readRange(header: string, size: number): ByteRange {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "ignored";
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

/**
 * Answers a media request with byte ranges. Workers static assets reply to a `Range` request with
 * the whole file and status 200, which leaves a film without seeking; this builds the 206 from the
 * asset instead. The asset is read whole for each range, so it is meant for a few short films.
 */
export async function serveMediaRange(request: Request, assets: AssetFetcher): Promise<Response> {
  const headers = new Headers(request.headers);
  const requested = headers.get("range");
  headers.delete("range");
  const asset = await assets.fetch(new Request(request.url, { method: request.method, headers }));
  if (asset.status !== 200) return asset;

  const answer = new Headers(asset.headers);
  answer.set("Accept-Ranges", "bytes");
  if (request.method !== "GET" || requested === null) {
    return new Response(asset.body, { status: 200, headers: answer });
  }
  const body = await asset.arrayBuffer();
  const range = readRange(requested, body.byteLength);
  if (range === "ignored") {
    answer.set("Content-Length", String(body.byteLength));
    return new Response(body, { status: 200, headers: answer });
  }
  if (range === "unsatisfiable") {
    answer.set("Content-Range", `bytes */${body.byteLength}`);
    answer.delete("Content-Length");
    return new Response(null, { status: 416, headers: answer });
  }
  answer.set("Content-Range", `bytes ${range.start}-${range.end}/${body.byteLength}`);
  answer.set("Content-Length", String(range.end - range.start + 1));
  return new Response(body.slice(range.start, range.end + 1), { status: 206, headers: answer });
}
