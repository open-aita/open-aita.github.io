# home 章节规则

- 章节 ID：`home`；公开路由基线：`/`；离线 Demo 入口：`#top`。
- 允许读取的领域集合：projects, outputs, achievements, events, organizations, siteSettings。
- 写入必须调用清单中声明的 Operation，禁止直接编辑同类实体文件。
- 页面组合必须使用组件注册表与语义令牌。
- 姓名仅可出现在所属条目的 `contributors` 字段中。
- 完成前运行 `node tools/aita.mjs verify --changed --json`。
