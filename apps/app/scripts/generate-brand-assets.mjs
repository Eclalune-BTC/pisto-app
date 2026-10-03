import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const brandRoot = new URL("../assets/brand/", import.meta.url);
const mark = JSON.parse(await readFile(new URL("mark.json", brandRoot), "utf8"));

function svg(foreground, background, scale = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${mark.viewBox}"><title>Pisto</title>${background ? `<rect width="64" height="64" fill="${background}"/>` : ""}<g transform="translate(32 32) scale(${scale}) translate(-32 -32)"><path d="${mark.path}" fill="${foreground}" fill-rule="evenodd"/></g></svg>`;
}

const outputs = [
  { name: "icon.png", size: 1024, foreground: mark.paper, background: mark.ink },
  { name: "adaptive-foreground.png", size: 1024, foreground: mark.paper, scale: 0.8 },
  { name: "monochrome.png", size: 1024, foreground: "#FFFFFF", scale: 0.8 },
  { name: "splash-icon.png", size: 512, foreground: mark.ink },
  { name: "splash-icon-dark.png", size: 512, foreground: mark.paper },
  { name: "favicon.png", size: 64, foreground: mark.paper, background: mark.ink },
];

for (const output of outputs) {
  const image = sharp(Buffer.from(svg(output.foreground, output.background, output.scale)), {
    density: 1152,
  }).resize(output.size, output.size);
  if (output.background) image.flatten({ background: output.background }).removeAlpha();
  await image.png().toFile(fileURLToPath(new URL(output.name, brandRoot)));
}

await writeFile(
  new URL("adaptive-background.png", brandRoot),
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: mark.ink } })
    .png()
    .toBuffer(),
);
await writeFile(new URL("mark.svg", brandRoot), `${svg(mark.paper, mark.ink)}\n`);
console.log("Generated Pisto brand assets from assets/brand/mark.json.");
