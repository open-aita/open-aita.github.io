# AITA Research Lab

网站由 Astro 静态构建。唯一页面入口是 `apps/site/src/pages/index.astro`，发布目录是 `dist/`。

## 开发与检查

使用 Node.js 22.12+ 和 npm；仓库只维护 `package-lock.json`，不使用 pnpm workspace。

```sh
npm ci
npm run dev
npm run check
npm run build
npm run verify
npm run smoke
npm run preview
```

开发和预览地址为 `http://127.0.0.1:4174/`；两个服务不要同时占用同一端口。首次运行浏览器检查需 `npx playwright install chromium`；Windows 已安装 Edge 时检查脚本会使用 Edge。

## 日常修改

- 页面事实：`content/*.json`。已有标准操作用 `node tools/aita.mjs task list` 查找，再执行 Plan → dry-run → Apply；Apply 后重新构建即可更新页面。
- 页面章节：`plugins/<id>/Section.astro`、`styles.css`、可选 `client.js`。章节清单实际决定入口、顺序和导航；Paths 已包含在内。
- 共用品牌、按钮和视觉变量：`packages/design-system/`。`tokens.css` 是唯一的全局令牌源。
- 三处“加入 AITA”链接：修改 `content/recruitment.json` 首条记录的 `formUrl`。未配置时统一跳到 `#join`。
- 工作、实习、升学去向：`content/member-paths.json`。只保存机构、岗位和汇总人数，不增加姓名。
- 图片：`apps/site/public/assets/images/`；活动图片的路径和替代文本由 `content/media-assets.json` 管理。

`node tools/aita.mjs preview create --json` 会重新构建并生成当前桌面、手机截图；不会复用历史截图。产物保存在忽略提交的 `.work/preview/`。

## 发布

GitHub Actions 在 PR 和 `main` 上运行类型检查、构建、内容与资源验证、Recipe 和浏览器检查，通过后由 `main` 发布 `dist/`。GitHub Pages 的 Source 应设置为 **GitHub Actions**；不要继续发布仓库根目录。

详细边界与验收说明见 [架构说明](docs/architecture.md)。旧设计保存在 `docs/archive/`，不代表当前已实现能力。
