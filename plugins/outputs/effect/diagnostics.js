// 启动错误收集（便于交付后远程诊断）：console 里执行 window.__errs 即可查看
window.__errs = [];
window.addEventListener("error", e => window.__errs.push("error: " + (e.message || e.type) + " @ " + (e.filename || "") + ":" + (e.lineno || "")));
window.addEventListener("unhandledrejection", e => window.__errs.push("reject: " + String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || "unknown").slice(0, 600)));
