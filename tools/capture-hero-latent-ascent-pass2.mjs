import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("hero-qa-pass2");
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.AITA_QA_URL || "http://127.0.0.1:4173/";
const reports = [];

const capture = async ({ name, width, height, waitMs, phase, reducedMotion = "no-preference" }) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: "load" });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });

  const metrics = await page.evaluate(() => {
    const sampleCanvas = (selector) => {
      const canvas = document.querySelector(selector);
      if (!(canvas instanceof HTMLCanvasElement)) return null;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) return null;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const stride = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 18000)));
      let signal = 0;
      let green = 0;
      let samples = 0;
      for (let y = 0; y < canvas.height; y += stride) {
        for (let x = 0; x < canvas.width; x += stride) {
          const offset = ((y * canvas.width) + x) * 4;
          const alpha = data[offset + 3];
          samples += 1;
          if (alpha > 8) signal += 1;
          if (alpha > 18 && data[offset + 1] > data[offset] * 1.22 && data[offset + 1] > data[offset + 2] * 1.18) green += 1;
        }
      }
      return { signal, green, samples, signalRatio: signal / Math.max(1, samples) };
    };

    const hero = document.querySelector(".hero");
    const mountain = document.querySelector(".latent-ascent");
    const intro = document.querySelector(".aita-intro");
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth,
      horizontalOverflow: Math.max(0, documentWidth - innerWidth),
      introPresent: Boolean(intro),
      mountainPresent: Boolean(mountain),
      mountainVisible: mountain?.classList.contains("is-visible") || false,
      introPending: document.documentElement.classList.contains("hero-intro-pending"),
      heroVisual: hero?.getAttribute("data-hero-visual") || null,
      introCanvas: sampleCanvas(".aita-intro__canvas"),
      mountainCanvas: sampleCanvas(".latent-ascent__canvas")
    };
  });

  reports.push({ name, phase, waitMs, reducedMotion, metrics, consoleErrors, pageErrors });
  await context.close();
};

await capture({ name: "desktop-intro-0360ms", phase: "intro", width: 1440, height: 900, waitMs: 360 });
await capture({ name: "desktop-expansion-1120ms", phase: "transition", width: 1440, height: 900, waitMs: 1120 });
await capture({ name: "desktop-final-2100ms", phase: "final", width: 1440, height: 900, waitMs: 2100 });
await capture({ name: "mobile-intro-0360ms", phase: "intro", width: 390, height: 844, waitMs: 360 });
await capture({ name: "mobile-expansion-1120ms", phase: "transition", width: 390, height: 844, waitMs: 1120 });
await capture({ name: "mobile-final-2100ms", phase: "final", width: 390, height: 844, waitMs: 2100 });
await capture({ name: "desktop-reduced-motion", phase: "reduced", width: 1440, height: 900, waitMs: 180, reducedMotion: "reduce" });

fs.writeFileSync(path.join(outputDir, "metrics.json"), `${JSON.stringify(reports, null, 2)}\n`, "utf8");
await browser.close();

const failures = [];
for (const report of reports) {
  failures.push(...report.consoleErrors.map((error) => `${report.name}: console: ${error}`));
  failures.push(...report.pageErrors.map((error) => `${report.name}: pageerror: ${error}`));
  if (report.metrics.horizontalOverflow > 0) failures.push(`${report.name}: horizontal overflow ${report.metrics.horizontalOverflow}px`);
  if (!report.metrics.heroVisual) failures.push(`${report.name}: hero marker missing`);
  if (!report.metrics.mountainPresent) failures.push(`${report.name}: mountain canvas missing`);
  if ((report.metrics.mountainCanvas?.signal || 0) < 120) failures.push(`${report.name}: insufficient mountain signal`);
  if ((report.metrics.mountainCanvas?.green || 0) < 1) failures.push(`${report.name}: mountain accent signal missing`);

  if (report.phase === "intro") {
    if (!report.metrics.introPresent) failures.push(`${report.name}: intro ended too early`);
    if ((report.metrics.introCanvas?.signal || 0) < 80) failures.push(`${report.name}: particle wordmark signal too weak`);
  }
  if (report.phase === "transition") {
    if (!report.metrics.introPresent) failures.push(`${report.name}: transition overlay ended too early`);
    if (!report.metrics.mountainVisible) failures.push(`${report.name}: mountain did not overlap particle dispersal`);
  }
  if (report.phase === "final" || report.phase === "reduced") {
    if (report.metrics.introPresent) failures.push(`${report.name}: intro overlay was not removed`);
    if (!report.metrics.mountainVisible) failures.push(`${report.name}: final mountain not visible`);
    if (report.metrics.introPending) failures.push(`${report.name}: page remained intro-locked`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    captures: reports.map(({ name, phase, metrics }) => ({ name, phase, metrics }))
  }, null, 2));
}
