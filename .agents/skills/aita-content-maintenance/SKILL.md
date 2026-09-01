# 内容维护

## 适用范围
用于 AITA 官网的内容维护任务。

## 工作流
1. 运行 `node tools/aita.mjs describe --json`。
2. 用 `task list` 定位 Operation，并读取对应 Schema。
3. 从用户材料提取事实与 Evidence；缺失信息保持为空。
4. 运行 `task plan`，检查风险、写入范围和语义影响。
5. Apply 后运行 `diff --semantic` 与 `verify --changed`。
6. 报告实体、路由、证据、检查结果和残余风险。

## 完成条件
- 标准验证通过。
- 无无关变更。
- 未推断原始材料缺失事实。
- 没有人员实体、人员页面或人员维护 Operation。
