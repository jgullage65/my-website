import { readFile, writeFile } from "node:fs/promises";

const path = "app/lib/ai-engine/crawler/crawlBusinessWebsite.ts";
const broken = 'const { chromium } = await (loadPlaywright ? loadPlaywright() : import("playwright") as Promise<{ chromium: { launch: (options: { headless: boolean; args?: string[] }) => Promise<PlaywrightBrowser> }>);';
const fixed = 'const { chromium } = await (loadPlaywright ? loadPlaywright() : import("playwright") as Promise<{ chromium: { launch: (options: { headless: boolean; args?: string[] }) => Promise<PlaywrightBrowser> } }>);';

const source = await readFile(path, "utf8");
if (source.includes(fixed)) process.exit(0);
if (!source.includes(broken)) {
  throw new Error("Expected crawler Playwright syntax was not found.");
}
await writeFile(path, source.replace(broken, fixed), "utf8");
