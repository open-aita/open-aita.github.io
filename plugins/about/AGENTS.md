# about 章节

- 实际入口为 `Section.astro`，网页锚点 `#about`；顺序和导航由本目录清单决定。
- 读取集合以 `chapter.manifest.json` 的 `consumes` 为准；新增读取时同步声明，验证器会检查。
- 样式放在本目录 `styles.css`，限定于本章节的 `data-plugin` 或 `data-plugin-owner`；共用变量引用设计系统。
- 交互由本目录客户端模块增强，经 `packages/kernel/client.js` 独立加载。不要依赖另一个章节的初始化顺序或全局工厂函数。
- 内容有现成 Operation 时使用 CLI；没有对应操作的汇总内容可直接编辑 JSON，由同一领域 Schema 校验。不要维护第二份 HTML 内容。
- 完成页面修改后执行根 README 中的相关检查，并查看当前桌面和手机预览；纯文档修改只核对路径和文字。
