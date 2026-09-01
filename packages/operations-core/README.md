# Operations Core

离线 Demo 的确定性实现位于 `packages/operations-core/index.mjs`，暴露 `query / plan / apply / semanticDiff`。CLI、Recipe 测试与未来 Studio/MCP 适配器共享该实现。CLI 不调用 LLM。
