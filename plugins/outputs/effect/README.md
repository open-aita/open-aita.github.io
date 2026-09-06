本目录保留迁移前已使用的粒子云，不新增 React 或 Three.js 的主站依赖。

- `index.html`：iframe 的静态入口和脚本装配顺序。
- `styles.css`：此 iframe 独享的样式。
- `bootstrap.js`：挂载及 AITA 播放／画质接入。
- `vendor/`：从既有单文件 HTML 原样解出的 Turbopack 模块。场景所在文件为 `14-cloud-mesh-hero.js`；它仍是预打包输入，不是重新获得的上游源码工程。

来源与模块说明保留在入口注释中。迁移没有改变第三方代码的许可范围。调整时保留版权与许可说明，并用当前浏览器检查验证效果；构建只复制这些固定输入，不从原网站下载或从 CDN 加载。
