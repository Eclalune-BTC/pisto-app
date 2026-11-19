import { describe, expect, test } from "bun:test";

import { type AssetFetcher, serveMediaRange } from "../src/media-range.ts";

const film = new Uint8Array(1_000).map((_, index) => index % 251);
const url = "https://pisto.example.test/media/coco-demo.mp4";

function assets(status = 200) {
  const seen: Request[] = [];
  const fetcher: AssetFetcher = {
    async fetch(request) {
      seen.push(request);
      return status === 200
        ? new Response(film, {
            headers: { "Content-Type": "video/mp4", ETag: '"film"', "Content-Length": "1000" },
          })
        : new Response("Not found", { status });
    },
  };
  return { fetcher, seen };
}

const ranged = (range: string, method = "GET") =>
  new Request(url, { method, headers: { Range: range } });

async function bytes(response: Response): Promise<number[]> {
  return [...new Uint8Array(await response.arrayBuffer())];
}

describe("media byte ranges", () => {
  test("a request without a range gets the whole film and learns that ranges are served", async () => {
    const { fetcher } = assets();
    const response = await serveMediaRange(new Request(url), fetcher);
    expect(response.status).toBe(200);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect((await bytes(response)).length).toBe(1_000);
  });

  test.each([
    ["bytes=0-9", 0, 9],
    ["bytes=990-", 990, 999],
    ["bytes=-10", 990, 999],
    ["bytes=500-5000", 500, 999],
    ["bytes=0-0", 0, 0],
    ["bytes=-5000", 0, 999],
  ])("%s answers 206 with exactly those bytes", async (range, start, end) => {
    const { fetcher, seen } = assets();
    const response = await serveMediaRange(ranged(range), fetcher);
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe(`bytes ${start}-${end}/1000`);
    expect(response.headers.get("Content-Length")).toBe(String(end - start + 1));
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("ETag")).toBe('"film"');
    expect(await bytes(response)).toEqual([...film.slice(start, end + 1)]);
    // The assets layer ignores ranges; it must be asked for the whole file.
    expect(seen[0]?.headers.get("range")).toBeNull();
  });

  test.each(["bytes=1000-", "bytes=1000-1200", "bytes=20-10", "bytes=-0"])(
    "%s cannot be satisfied",
    async (range) => {
      const response = await serveMediaRange(ranged(range), assets().fetcher);
      expect(response.status).toBe(416);
      expect(response.headers.get("Content-Range")).toBe("bytes */1000");
      expect((await bytes(response)).length).toBe(0);
    },
  );

  test.each(["bytes=0-9,20-29", "items=0-9", "bytes=a-b", "bytes=-"])(
    "%s is ignored and the whole film is sent",
    async (range) => {
      const response = await serveMediaRange(ranged(range), assets().fetcher);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Range")).toBeNull();
      expect((await bytes(response)).length).toBe(1_000);
    },
  );

  test("a missing file and a HEAD request pass through without a body of their own", async () => {
    const missing = await serveMediaRange(ranged("bytes=0-9"), assets(404).fetcher);
    expect(missing.status).toBe(404);
    const head = await serveMediaRange(ranged("bytes=0-9", "HEAD"), assets().fetcher);
    expect(head.status).toBe(200);
    expect(head.headers.get("Accept-Ranges")).toBe("bytes");
  });
});
