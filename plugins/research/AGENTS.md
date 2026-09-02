# research 章节规则

- 章节 ID：`research`；当前实际入口为根目录 `index.html#research`，项目子区为 `#projects`。清单中的 `/research` 是生产路由约定，不是当前已实现的独立页面。
- 允许读取的领域集合：projects, organizations, outputs, mediaAssets, evidence。
- 项目实体的新增、更新、归档必须调用清单中声明的 Operation，禁止直接编辑同类实体文件；该限制不适用于 HTML、CSS、JS 或维护文档修改。
- 当前区块结构位于 `index.html`，样式位于 `assets/css/styles.css`；Research 粒子场由 `assets/js/main-core.js` 中的 `research-field` 绘制逻辑负责，经 `assets/js/main.js` 加载。视觉改动按根 `AGENTS.md` 的页面开发流程执行。
- 页面组合优先复用现有组件模式与语义令牌，不为单个特效重建章节架构。
- 姓名仅可出现在所属条目的 `contributors` 字段中。
- 网页代码或内容变更完成前运行 `node tools/aita.mjs verify --changed --json`；纯文档修改按根规则核对。视觉验收使用当前页面，不使用历史预览代替。
