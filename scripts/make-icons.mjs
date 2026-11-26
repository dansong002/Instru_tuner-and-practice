// Renders public/icon.svg to the PNG sizes the web-app manifest needs.
// Run with: node scripts/make-icons.mjs   (uses the pre-installed Playwright Chromium)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// CommonJS require so a globally installed Playwright is found too.
const { chromium } = createRequire(import.meta.url)("playwright");

const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:#14161a}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}">`);
  await page.screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
console.log("icons written");
