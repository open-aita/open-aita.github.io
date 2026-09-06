CLI 的确定性 Plan、dry-run、Apply 与语义 Diff。预演和写入共享 transformDocument，先校验完整候选内容，再原子写入；历史存入 .aita/history。Apply 不自动构建，发布前须执行 npm run build。
