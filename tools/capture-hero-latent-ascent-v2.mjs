import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("hero-qa");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.AITA_QA_URL || "http://127.0.0.1:4173/";
const reports = [];

const capture = async ({ name, width, height, waitMs, reducedMotion = "no-preference" }) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: "load" });
  await page.waitForTimeout(waitMs);
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: false
  });

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    const mountain = document.querySelector(".latent-ascent");
    const intro = document.querySelector(".aita-intro");
    const root = document.documentElement;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth,
      horizontalOverflow: Math.max(0, documentWidth - innerWidth),
      introPresent: Boolean(intro),
      mountainPresent: Boolean(mountain),
      mountainVisible: mountain?.classList.contains("is-visible") || false,
      heroVisual: hero?.getAttribute("data-hero-visual") || null,
      introPending: root.classList.contains("hero-intro-pending"),
      heroRect: hero ? {
        top: Math.round(hero.getBoundingClientRect().top),
        left: Math.round(hero.getBoundingClientRect().left),
        width: Math.round(hero.getBoundingClientRect().width),
        height: Math.round(hero.getBoundingClientRect().height)
      } : null
    };
  });

  reports.push({ name, waitMs, reducedMotion, metrics, consoleErrors, pageErrors });
  await context.close();
};

await capture({ name: "desktop-intro-0360ms", width: 1440, height: 900, waitMs: 360 });
await capture({ name: "desktop-transition-0820ms", width: 1440, height: 900, waitMs: 820 });
await capture({ name: "desktop-final-2100ms", width: 1440, height: 900, waitMs: 2100 });
await capture({ name: "mobile-intro-0360ms", width: 390, height: 844, waitMs: 360 });
await capture({ name: "mobile-final-2100ms", width: 390, height: 844, waitMs: 2100 });
await capture({ name: "desktop-reduced-motion", width: 1440, height: 900, waitMs: 180, reducedMotion: "reduce" });

fs.writeFileSync(path.join(outputDir, "metrics.json"), `${JSON.stringify(reports, null, 2)}\n`, "utf8");
await browser.close();

const failures = reports.flatMap((report) => [
  ...report.consoleErrors.map((error) => `${report.name}: console: ${error}`),
  ...report.pageErrors.map((error) => `${report.name}: pageerror: ${error}`),
  ...(report.metrics.horizontalOverflow > 0 ? [`${report.name}: horizontal overflow ${report.metrics.horizontalOverflow}px`] : []),
  ...(!report.metrics.mountainPresent ? [`${report.name}: mountain missing`] : []),
  ...(!report.metrics.heroVisual ? [`${report.name}: hero visual marker missing`] : [])
]);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, captures: reports.map(({ name, metrics }) => ({ name, metrics })) }, null, 2));
}
