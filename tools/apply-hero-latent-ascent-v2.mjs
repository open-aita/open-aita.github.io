import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const write = (relativePath, content) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
};

const htmlPath = "index.html";
let html = read(htmlPath);

const earlyBoot = '<script>document.documentElement.classList.add("hero-intro-pending");window.setTimeout(function(){document.documentElement.classList.remove("hero-intro-pending");},2400);</script>';
if (!html.includes("hero-intro-pending")) {
  html = html.replace("<title>AITA — Toward Infinite Intelligence</title>", `<title>AITA — Toward Infinite Intelligence</title>\n${earlyBoot}`);
}

const visualStyle = '<link href="assets/css/hero-latent-ascent-v2.css" rel="stylesheet"/>';
if (!html.includes("hero-latent-ascent-v2.css")) {
  html = html.replace('<link href="assets/css/styles.css" rel="stylesheet"/>', `<link href="assets/css/styles.css" rel="stylesheet"/>\n${visualStyle}`);
}

const visualScript = '<script defer="" src="assets/js/hero-latent-ascent-v2.js"></script>';
if (!html.includes("hero-latent-ascent-v2.js")) {
  html = html.replace('<script defer="" src="assets/js/main.js"></script>', `${visualScript}\n<script defer="" src="assets/js/main.js"></script>`);
}

html = html.replace(
  '<section class="hero shell" data-plugin="home" id="top">',
  '<section class="hero shell" data-hero-visual="latent-ascent" data-plugin="home" id="top">'
);
write(htmlPath, html);

const registryPath = "agent/component-registry.json";
const registry = JSON.parse(read(registryPath));
registry.components.LatentAscentHero = {
  purpose: "首页首访粒子字标与 ASCII 点阵科研攀登山体",
  propsSchema: "agent/schemas/ui/latent-ascent-hero.schema.json",
  allowedVariants: ["default", "reduced-motion"],
  allowedContexts: ["home"],
  clientJavaScriptKb: 8,
  accessibilityRules: [
    "视觉层必须标记为装饰，不进入可访问性树",
    "prefers-reduced-motion 下跳过首访粒子动效",
    "脚本异常时必须在 2.4 秒内恢复正文可见性",
    "关闭 JavaScript 后正文与导航仍完整可用"
  ]
};
write(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

const schemaPath = "agent/schemas/ui/latent-ascent-hero.schema.json";
write(schemaPath, `${JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "LatentAscentHero props",
  type: "object",
  additionalProperties: false,
  properties: {
    variant: { type: "string", enum: ["default", "reduced-motion"] },
    introDurationMs: { type: "integer", minimum: 0, maximum: 2400, default: 1510 },
    climberCount: { type: "integer", minimum: 1, maximum: 5, default: 3 }
  }
}, null, 2)}\n`);

const manifestPath = "plugins/home/chapter.manifest.json";
const manifest = JSON.parse(read(manifestPath));
manifest.version = "1.1.0";
manifest.capabilities = Array.from(new Set([
  ...(manifest.capabilities || []),
  "particle-wordmark-intro",
  "ascii-mountain-illustration"
]));
write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  changed: [htmlPath, registryPath, schemaPath, manifestPath],
  visual: {
    introDurationMs: 1510,
    climbers: 3,
    idleAnimation: false,
    reducedMotion: "static-mountain"
  }
}, null, 2));
