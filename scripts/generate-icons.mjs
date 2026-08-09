import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "icon-source.svg");
const svgBuffer = readFileSync(svgPath);

const publicDir = join(__dirname, "..", "public");
const appDir = join(__dirname, "..", "src", "app");

async function generate(outputPath, size, options = {}) {
  let pipeline = sharp(svgBuffer, { density: 384 }).resize(size, size);
  if (options.padPercent) {
    const inner = Math.round(size * (1 - options.padPercent * 2));
    pipeline = sharp(svgBuffer, { density: 384 })
      .resize(inner, inner)
      .extend({
        top: Math.round((size - inner) / 2),
        bottom: Math.round((size - inner) / 2),
        left: Math.round((size - inner) / 2),
        right: Math.round((size - inner) / 2),
        background: "#4F46E5",
      });
  }
  await pipeline.png().toFile(outputPath);
  console.log(`Generated ${outputPath}`);
}

async function main() {
  await generate(join(publicDir, "icon-192x192.png"), 192);
  await generate(join(publicDir, "icon-512x512.png"), 512);
  await generate(join(publicDir, "icon-maskable-512x512.png"), 512, { padPercent: 0.1 });
  await generate(join(appDir, "icon.png"), 512);
  await generate(join(appDir, "apple-icon.png"), 180);
}

main();
