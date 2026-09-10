import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appManifest = fileURLToPath(new URL("../apps/app/package.json", import.meta.url));

// Resolve the same transitive dependency as Expo Router, including nested installs.
// A child process lets the deadline stop a regressed synchronous decoding algorithm.
const regression = String.raw`
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const appRequire = createRequire(process.argv[1]);
const routerRequire = createRequire(appRequire.resolve("expo-router/package.json"));
const query = routerRequire("query-string");

assert.deepEqual({ ...query.parse("name=Mar%C3%ADa+Jos%C3%A9") }, {
  name: "Mar\u00eda Jos\u00e9",
});
assert.deepEqual({ ...query.parse("a=1&a=2&empty=&null") }, {
  a: ["1", "2"], empty: "", null: null,
});
assert.deepEqual({ ...query.parse("value=%C3%5A%A5&percent=%2525") }, {
  value: "%C3Z%A5", percent: "%25",
});
assert.equal(query.parse("q=a%2Bb+c").q, "a+b c");
assert.equal(query.parse("q=%FF%25%9F").q, "%FF%%9F");
assert.deepEqual(query.parseUrl("https://pisto.example/path?q=one%20two#frag", {
  parseFragmentIdentifier: true,
}), {
  url: "https://pisto.example/path",
  query: query.parse("q=one%20two"),
  fragmentIdentifier: "frag",
});
const original = { name: "Mar\u00eda Jos\u00e9", tags: ["uno", "dos"], empty: "" };
assert.deepEqual({ ...query.parse(query.stringify(original)) }, original);

// GHSA-vcc3-ghjq-m6fr: malformed percent encodings must complete within the child deadline.
const malformed = "%FF".repeat(20_000);
assert.equal(query.parse("q=" + malformed).q, malformed);
console.log("query decoder regressions passed");
`;

for (const [runtime, executable] of [
  ["Node", Bun.which("node")],
  ["Bun", process.execPath],
] as const) {
  test(`${runtime}: Expo Router query decoding remains compatible and bounded`, () => {
    if (!executable) throw new Error(`${runtime} must be installed to verify query decoding`);

    const result = spawnSync(executable, ["-e", regression, appManifest], {
      encoding: "utf8",
      timeout: 8_000,
      killSignal: "SIGKILL",
      maxBuffer: 1_048_576,
    });

    if (result.error) {
      throw new Error(`${runtime} query decoding failed or exceeded 8 seconds`, {
        cause: result.error,
      });
    }
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("query decoder regressions passed");
  }, 12_000);
}
