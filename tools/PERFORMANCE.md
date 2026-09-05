# 官网特效维护

页面仍直接使用根目录 `index.html` 和 `assets/`，无需构建。

## 静态画面与原始代码

- Projects 页面加载 `assets/images/projects-knight-1920.webp`，1920 × 384，保留原作 5:1 比例，适配 1080p 显示范围。
- 骑士完整绘图代码、调色板和压缩图层仍在 `assets/effects/projects-knight-particles.html`。修改这个文件后重新导出；页面不会自动更新图片。
- 地图点云原始数据在 `assets/effects/network-cloud-source.json`，绘制规则在 `tools/export-static-art.html`。网页只读取导出的两张地图图片，坐标、裁切、搜索和交互仍由 `assets/js/network-atlas.js` 负责。
- 浏览器导出工具在 `tools/export-static-art.html`，不需要新增 Node 包或生产依赖。用与页面相同的 Chrome Canvas 渲染，避免其他 Canvas 实现造成颜色和发光差异。

在仓库根目录启动预览：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4173/tools/export-static-art.html`，点击生成和下载。将骑士图下载文件改名为 `projects-knight-1920.webp`，两张地图改名为 `network-main.webp`、`network-gba.webp`，替换 `assets/images/` 中的对应文件。

输出为质量 95 的 WebP。生成后查看骑士明暗与发光、地图小点清晰度，并检查桌面和移动布局。更新图片时同步增加 `index.html` 或 `network-atlas.js` 中的版本参数。

## 自适应画质与暂停

`assets/js/effect-budget.js` 只测量真实帧回调间隔，自身不启动动画循环。开始/恢复后留出 2 秒预热；连续两个 2 秒窗口低于 45 FPS 降一级；连续 20 秒不低于 55 FPS 才升一级。它反映浏览器实际调度表现，不是独立 GPU 基准。

- About：核心节点不随 iframe 布局断点突然增加；默认 65,536 个尘埃，低档通过 `drawRange` 降到最多 36,864 个，不重建缓冲区。像素倍率按 1 / 1.25 / 1.5 分档，另有总像素面积上限。`lite`、`n`、`dust`、`fixdt` 参数保留用于作者调整。
- Outputs：默认 WebGL tier 2，结合实时画质控制分辨率、粒子容量与后处理；显式 `gpuTier` / 原有本地覆盖优先。相机和场景时间在暂停时保持。
- `main-core.js` 将附近两个 WebGL 模块的启动排队，预加载与播放分开。只有进入视野且页面可见才播放；离屏、后台暂停，返回后恢复。减少动态效果偏好下不加载这两个装饰 iframe。
- Research 的绘制链和既有滤镜需用对照数据决定是否调整，不能仅凭属性名称删除。

## 检查

```sh
node tools/test-effect-budget.mjs
node --check assets/js/effect-budget.js
node --check assets/js/main-core.js
node --check assets/js/network-atlas.js
node tools/aita.mjs verify --changed --json
```

两个特效 HTML 中的内联 JavaScript 也需要单独提取做语法检查；跳过 base64 数据块和 importmap。项目验证器的基础 JS 体积检查只覆盖加载器，不能代表全部特效。

在同一浏览器、可用页面宽度、电源模式下比较首次滚动与再次经过；开发者工具独立窗口可避免触发响应式断点。重点验证 980px 附近、手机宽度、搜索/筛选/地图标记、离屏恢复和减少动态效果。优先观察长任务、绘制与合成，不以加载分数代替滚动验证。

## 2026-09-05 本地验证

- Chrome，M1 / 8GB，测试页内 1380 × 700 视口、DPR 2。复测时机器已接入电源；这些数值不能外推为电池低电量模式下的通用帧率。
- 在优化前的工作区副本与优化后副本中，仅给 `renderAll` 添加首尾计时。地图首次同步绘制从 73.0 ms 降至 17.3 ms；换用最终 Chrome 导出的图片后复测为 15.4 ms。原版记录到一个 73 ms 长任务，两次优化后采样均未记录到长任务。图片异步解码时间不包含在 `renderAll` 耗时中。
- Research 的 5 秒采样包含 150 次跨画布复制，JavaScript 调用累计 22.3 ms、单次最大 0.4 ms；帧回调间隔 P95 约 17.6 ms，未记录到超过 34 ms 的间隔。这不是完整 GPU 耗时测量，保留现有绘制链。
- 成果区保留和移除滤镜的短时采样均未出现超过 34 ms 的帧回调间隔；两次自适应画质档位不同，不能把差异归因于滤镜。因此没有修改生产滤镜。
- 已查看桌面、900px 断点及 390px 手机布局；修正静态骑士图受全局 `max-width` 限制导致的手机裁切问题。地图搜索、重置和区域入口正常，33 个合作单位记录及全部地图原始点数据保持一致。
- 真实浏览器的短时主线程压力测试触发了画质下降；独立回归测试覆盖 30/20/15/10 FPS、稳定恢复、离屏重置、短暂卡顿及 lite 档位边界。离屏时 About Canvas 与噪点动画、成果粒子云均暂停。
- 测试页模拟 `prefers-reduced-motion` 的 JavaScript 查询结果后，进入 About 和 Outputs 均不加载对应 iframe；没有更改系统的动态效果偏好。
- 本次原始对照和检查输出放在被 Git 忽略的 `.work/performance-20260905/`。项目规范验证通过 14 项，保留既有 changed-scope 全量检查警告。没有实测 Windows 或实体手机，也没有完成 `file://` 下同条件的性能录制。
