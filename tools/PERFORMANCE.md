# 特效维护与资源预算

网站使用 Astro 构建，主站样式与脚本按章节维护。资源预算在 `config/performance.json`，由 `npm run verify` 对实际 dist 逐文件计量；两个 iframe 的 HTML、CSS、JS、vendor 与共享画质脚本分别汇总。

## 修改入口

- Research：`plugins/research/client.js` 与 `galaxy.js`。
- About：`plugins/about/effect/scene.js`，本地 Three.js 位于同目录 vendor。
- Outputs：`plugins/outputs/effect/`；原有预打包模块的边界见该目录 README。
- IP 静态粒子：`plugins/outputs/client.js`。
- Join：`plugins/join/client.js`。
- 地图交互：`plugins/partners/client.js`；事实数据由 organizations.json 提供，图形避让参数在 map-layout.json。

iframe 由 `packages/kernel/effects.js` 排队启动；Outputs 在页面首次加载完成后利用空闲队列提前准备，About 仍在附近启动，二者都只在进入视野且页面可见时播放。减少动态效果时不加载装饰 iframe。Network 的两张静态点云图在首次加载后以低优先级下载，到附近再绘制，各自就绪后独立显示。`packages/kernel/effect-budget.js` 继续使用真实帧间隔控制画质，不新增外部 GPU 基准请求。

修改特效后重新运行 `npm run build` 或重新启动 dev 准备步骤。不要修改自动生成的 `apps/site/public/effects/`。

## 重新导出静态画面

骑士源代码、地图点云与浏览器导出页都保留在 `tools/artwork/`，不进入发布目录。只在需要重新生成图片时，从仓库根目录运行：

```sh
python -m http.server 4175 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4175/tools/artwork/export.html`。下载后分别替换 `apps/site/public/assets/images/projects-knight-1920.webp`、`network-main.webp`、`network-gba.webp`。普通网页预览使用 `npm run dev`，不是这个开发用文件服务器。

静态图片更新可使用新文件名并同步引用以避免旧缓存；主站 CSS 和脚本的产物引用由 Astro 管理。不要为内容或样式更新运行历史自动修订脚本。

## 检查

运行 `node tools/test-effect-budget.mjs` 检查画质算法；运行 `npm run build`、`npm run verify` 和相关的 `npm run smoke`，查看当前桌面与手机预览。预算检查不等于 FPS 测量。迁移前的 Mac 性能记录已存入 `docs/archive/特效性能记录_2026-09-05.md`，不能当成本次 Windows 验收结果。
