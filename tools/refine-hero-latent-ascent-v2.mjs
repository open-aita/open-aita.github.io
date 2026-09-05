import fs from "node:fs";

const jsPath = "assets/js/hero-latent-ascent-v2.js";
const cssPath = "assets/css/hero-latent-ascent-v2.css";
let js = fs.readFileSync(jsPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const replacements = [
  ["<span>23°08′ / 113°16′</span><span>RESEARCH ALTITUDE / OPEN</span>", "<span>VECTOR / 0.68</span><span>RIDGE STATE / OPEN</span>"],
  ["const burst = easeInCubic((elapsed - 610) / 800);", "const burst = easeInCubic((elapsed - 560) / 720);"],
  ["const fade = 1 - smoothstep((elapsed - 730) / 700);", "const fade = 1 - smoothstep((elapsed - 950) / 500);"],
  ["const reveal = smoothstep((elapsed - 570) / 680);", "const reveal = smoothstep((elapsed - 620) / 640);"],
  ["if (elapsed > 540 && !mountain.classList.contains(\"is-visible\"))", "if (elapsed > 600 && !mountain.classList.contains(\"is-visible\"))"],
  ["if (elapsed > 930 && root.classList.contains(\"hero-intro-pending\"))", "if (elapsed > 950 && root.classList.contains(\"hero-intro-pending\"))"]
];

for (const [before, after] of replacements) {
  if (js.includes(before)) js = js.replace(before, after);
}

// Slightly increase the information density of the final mountain after the
// first visual pass while preserving the low-contrast hierarchy.
css = css.replace("opacity: .92;\n    transform: translate3d(0, 0, 0) scale(1);", "opacity: .96;\n    transform: translate3d(0, 0, 0) scale(1);");
css = css.replace(".latent-ascent.is-visible { opacity: .80; }", ".latent-ascent.is-visible { opacity: .84; }");
css = css.replace(".latent-ascent.is-visible { opacity: .74; }", ".latent-ascent.is-visible { opacity: .78; }");

fs.writeFileSync(jsPath, js, "utf8");
fs.writeFileSync(cssPath, css, "utf8");

console.log(JSON.stringify({
  ok: true,
  refinements: [
    "replace geographic-looking decorative coordinates with abstract system readouts",
    "delay overlay fade until the expansion phase is visually legible",
    "move the mountain reveal into the particle expansion overlap",
    "raise final mountain contrast by four percentage points"
  ]
}, null, 2));
