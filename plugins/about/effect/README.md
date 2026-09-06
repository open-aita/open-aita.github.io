`scene.js` 保存原有共识星野逻辑；`styles.css` 和 `index.html` 是独立 iframe 的样式与结构。原先内嵌的 Three.js 从 base64 解码到 `vendor/three.module.js`，保留许可声明，使用本地 ES module 导入。

修改本目录后重新运行 build 或 dev 准备步骤。统一的画质预算在 `packages/kernel/effect-budget.js`；进入视野、后台暂停、减少动态效果等行为由父章节和特效协作控制。
