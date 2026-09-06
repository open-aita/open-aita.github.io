schema.mjs 是内容字段、枚举与必填项的唯一规则源。index.mjs 用 AJV 校验整份内容、永久 ID、引用与重复 slug，并由这些规则派生 Operation 输入 Schema。对象形式的 settings 与 member-paths 同样参与验证。
