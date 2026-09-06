# AITA 网站维护规则

## 实际入口与范围

- 唯一页面源码入口为 `apps/site/src/pages/index.astro`，由 Astro 构建到 `dist/`；不要恢复根目录 HTML 或手工维护构建产物。
- 内容事实在 `content/`，可执行 Schema 在 `packages/domain/`；章节代码在 `plugins/<id>/`。具体命令见根 README。
- 先说明任务目标、非目标、验收标准及不改动的范围。普通内容或样式任务只改相关章节，避免引入新框架、兼容层或空壳包。
- 保留用户已确认的文案、Logo、动效、页面顺序与响应式行为。去向统计不出现姓名。

## 内容与代码

- 有现成 Operation 的内容变更使用 CLI Plan → dry-run → Apply；`task schema` 返回从领域规则派生的实际输入约束。Apply 后构建网站，不再手动同步 HTML。
- 没有 Operation 的结构化汇总可直接修改 JSON；提交前必须经过同一领域校验。不为一次更新新建操作框架。
- 缺失的机构、状态、日期与联系方式不得推断补齐。重要事实有 Evidence；图片有来源和替代文本。
- 章节清单决定真实入口、顺序、导航和内容依赖。章节使用自己的 CSS 和客户端模块；共享品牌、按钮与变量放在 design-system。
- 客户端通过 mountChapter 独立增强；不依赖其他章节已初始化，也不新增全局业务变量。当前是单页静态网站，不需要客户端路由或通用插件 SDK。
- About、Outputs 的 iframe 源码位于各自 `effect/`；`apps/site/public/effects/` 仅是构建准备阶段生成的副本。

## 验收

- 内容或网页代码：`npm run check` → `npm run build` → `npm run verify`；相关交互变化再执行现有 `npm run smoke`。动效预算算法变化运行 `node tools/test-effect-budget.mjs`。
- verify 检查本次 dist，包括动态导入的全部主站脚本和两套 iframe 资源；它不代替真实浏览器检查。
- 视觉变化须查看当前桌面与手机截图；`aita preview create` 重新构建并生成预览。历史截图不能作为当前验收。
- 只运行相关的现有检查；不为可逆低风险改动补充无关测试或新测试框架。
- 文档修改只核对路径、命令与 diff。`docs/archive/` 是历史设计，不能当成当前实现。
- 不修改用户已有变更，不暴露凭据。按用户在当前会话中的授权提交、推送或发布；没有授权不主动发布。
