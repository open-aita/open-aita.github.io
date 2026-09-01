(() => {
  "use strict";
  const current = document.currentScript;
  const base = current?.src ? new URL(".", current.src) : new URL("assets/js/", document.baseURI);
  ["hero-ascent.js", "main-core.js"].forEach((file) => {
    const script = document.createElement("script");
    script.src = new URL(file, base).href;
    script.async = false;
    document.head.append(script);
  });
})();
