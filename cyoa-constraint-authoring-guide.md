# CYOA 约束工具箱作者指南

> 目标：你只搭架子，游戏作者按需填配置。  
> 本文档对应当前插件已落地字段与运行逻辑。

---

## 1. 当前已实现能力清单

- 系统约束模板（`narrator.systemPromptTemplate`）支持变量渲染。
- 模板重置按钮（编辑器一键回到默认合同模板）。
- 约束档位（`strict / balanced / free`）。
- 温度与 Top P（建议值 + 玩家可自定义）。
- 约束方案预设（新手/进阶/硬核，一键应用）。
- 动态公理化压缩（开关 + 最大注入条数 + 公理列表）。
- Hook 扩展点（`onPlayerInput` / `onAIOutput`）。
- Hook 安全执行层（黑名单、只读上下文、异常兜底）。
- 统一 AI 请求适配层（`provider` + `max_tokens` 注入）。
- `responseMode`（`text` / `json`）与 JSON 失败自动回退。

---

## 2. 关键配置字段（作者视角）

### 2.1 `game.narrator`

```json
{
  "model": "openai::gpt-4o-mini",
  "provider": "openai",
  "style": "情感细腻",
  "prompt": "你是一位专业的游戏剧情叙述者...",
  "systemPromptTemplate": "",
  "axiomInjectEnabled": true,
  "axiomMaxCount": 10,
  "maxTokens": 500,
  "guardPromptTemplate": "",
  "responseMode": "text"
}
```

- `systemPromptTemplate`：空字符串时使用内置默认模板。
- `axiomInjectEnabled`：是否将 `game.axioms` 注入系统模板。
- `axiomMaxCount`：每轮最多注入公理条数（1~20）。
- `provider`：可选，若留空则由模型值推断。
- `maxTokens`：单次输出上限（64~4096）。
- `guardPromptTemplate`：可用 `{{DEFAULT_GUARD}}` 与 `{{SYSTEM_PROMPT_TEMPLATE}}`。

### 2.2 `game.axioms`

```json
{
  "axioms": [
    "主角是亡灵，不能进入光明神殿",
    "境界压制不可逆",
    "死亡不可逆（除非设定明确允许）"
  ]
}
```

- 每行一条，建议 10~20 条核心公理。
- 模板通过 `{{#each axioms}}` 渲染。

### 2.3 `game.hooks`

```json
{
  "hooks": {
    "onPlayerInput": "function(input, ctx) { return input; }",
    "onAIOutput": "function(text, ctx) { return text; }"
  }
}
```

- 返回 `undefined` 时沿用原值。
- Hook 运行在安全策略下，危险能力会被拒绝。

---

## 3. 约束方案预设（已内置）

- 新手（稳）  
  - `AI_GUARD_PROFILE = strict`  
  - `AI_CHAT_TEMPERATURE = 0.10`  
  - `AI_TOP_P = 0.80`

- 进阶（推荐）  
  - `AI_GUARD_PROFILE = balanced`  
  - `AI_CHAT_TEMPERATURE = 0.15`  
  - `AI_TOP_P = 0.85`

- 硬核（最严）  
  - `AI_GUARD_PROFILE = strict`  
  - `AI_CHAT_TEMPERATURE = 0.08`  
  - `AI_TOP_P = 0.75`

---

## 4. 默认模板变量

系统模板支持以下变量：

- `{{roleType}}`
- `{{characterName}}`
- `{{character.background}}`
- `{{character.personality}}`
- `{{character.knowledge}}`
- `{{#each axioms}}{{this}}{{/each}}`

---

## 5. 建议组合（给游戏作者）

- 新手作者：  
  预设选“进阶（推荐）”，`responseMode=text`，只填公理与角色卡。

- 进阶作者：  
  开启 `axiomInjectEnabled`，补 `onPlayerInput`（输入清洗）与 `onAIOutput`（输出裁剪）。

- 硬核作者：  
  自定义 `guardPromptTemplate`，配合 `{{SYSTEM_PROMPT_TEMPLATE}}` 与 `responseMode=json`。

---

## 6. 注意事项

- 本插件是“工具箱”，不是“内容裁判”。  
  出不出戏由作者配置和模型选择共同决定。
- Hook 用于轻量改写，不建议写重逻辑循环。
- 当 `responseMode=json` 时，建议作者给出严格示例输出。
- 若模型经常放飞，优先降低 `temperature` 再收紧模板。

---

## 7. 最小可用示例

```json
{
  "name": "暗黑神殿",
  "axioms": [
    "主角是亡灵，不能进入光明神殿",
    "魔法消耗精力值"
  ],
  "narrator": {
    "model": "openai::gpt-4o-mini",
    "provider": "openai",
    "responseMode": "text",
    "axiomInjectEnabled": true,
    "axiomMaxCount": 10,
    "maxTokens": 500,
    "systemPromptTemplate": ""
  }
}
```

