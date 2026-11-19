import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const brandRoot = new URL("../assets/brand/", import.meta.url);
const mark = JSON.parse(await readFile(new URL("mark.json", brandRoot), "utf8"));

function svg(foreground, background, scale = 1, radius = 0) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${mark.viewBox}"><title>Pisto</title>${background ? `<rect width="64" height="64" rx="${radius}" fill="${background}"/>` : ""}<g transform="translate(32 32) scale(${scale}) translate(-32 -32)"><path d="${mark.path}" fill="${foreground}" fill-rule="evenodd"/></g></svg>`;
}

// The path fills its box so the in-app mark needs no padding; a tile gives it room to breathe,
// and an Android adaptive layer keeps it inside the launcher's masked safe zone.
const ON_TILE = 0.64;
const IN_SAFE_ZONE = 0.56;

const outputs = [
  { name: "icon.png", size: 1024, foreground: mark.paper, background: mark.ink, scale: ON_TILE },
  { name: "adaptive-foreground.png", size: 1024, foreground: mark.paper, scale: IN_SAFE_ZONE },
  { name: "monochrome.png", size: 1024, foreground: "#FFFFFF", scale: IN_SAFE_ZONE },
  { name: "splash-icon.png", size: 512, foreground: mark.ink, scale: ON_TILE },
  { name: "splash-icon-dark.png", size: 512, foreground: mark.paper, scale: ON_TILE },
  {
    name: "favicon.png",
    size: 64,
    foreground: mark.paper,
    background: mark.ink,
    radius: mark.radius,
    scale: ON_TILE,
  },
];

for (const output of outputs) {
  const image = sharp(
    Buffer.from(svg(output.foreground, output.background, output.scale, output.radius)),
    {
      density: 1152,
    },
  ).resize(output.size, output.size);
  if (output.background && !output.radius)
    image.flatten({ background: output.background }).removeAlpha();
  await image.png().toFile(fileURLToPath(new URL(output.name, brandRoot)));
}

await writeFile(
  new URL("adaptive-background.png", brandRoot),
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: mark.ink } })
    .png()
    .toBuffer(),
);
await writeFile(
  new URL("mark.svg", brandRoot),
  `${svg(mark.paper, mark.ink, ON_TILE, mark.radius)}\n`,
);
console.log("Generated Pisto brand assets from assets/brand/mark.json.");
