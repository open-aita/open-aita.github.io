(() => {
  "use strict";
  const current = document.currentScript;
  const currentUrl = current?.src ? new URL(current.src) : null;
  const base = currentUrl ? new URL(".", currentUrl) : new URL("assets/js/", document.baseURI);
  const version = currentUrl?.searchParams.get("v");
  ["research-galaxy.js", "main-core.js"].forEach((file) => {
    const script = document.createElement("script");
    const source = new URL(file, base);
    if (version) source.searchParams.set("v", version);
    script.src = source.href;
    script.async = false;
    document.head.append(script);
  });
})();
