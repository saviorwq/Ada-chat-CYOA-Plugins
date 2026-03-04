# 约束工具箱

本文用于给游戏作者快速上手“如何约束模型不放飞”。

## 一键预设

- 新手（稳）：`strict + temp 0.10 + top_p 0.80`
- 进阶（推荐）：`balanced + temp 0.15 + top_p 0.85`
- 硬核（最严）：`strict + temp 0.08 + top_p 0.75`

## 核心字段

- `narrator.systemPromptTemplate`
- `narrator.axiomInjectEnabled`
- `narrator.axiomMaxCount`
- `narrator.guardPromptTemplate`
- `narrator.responseMode`
- `narrator.provider`
- `narrator.maxTokens`
- `game.axioms`
- `game.hooks.onPlayerInput`
- `game.hooks.onAIOutput`

## 推荐组合

### 新手作者

- 预设选“进阶（推荐）”
- `responseMode=text`
- 填 10 条以内公理

### 进阶作者

- 开启公理注入
- 使用 `{{DEFAULT_GUARD}} + {{SYSTEM_PROMPT_TEMPLATE}}`
- 配置输入/输出 Hook

### 硬核作者

- `responseMode=json`
- 自定义 guard 模板
- 结合本地规则前置判定

