# 约束工具箱

本文面向“只搭框架”的插件作者与游戏作者，目标是：  
**让模型稳定叙事，不篡改规则，不越权扩写。**

---

## 约束设计原则

- 先用本地规则引擎判定，再让 AI 负责叙事润色
- 把长规则提炼成公理，按回合注入（利用近因效应）
- 参数与模板一起用，不要只调温度
- 默认走低风险策略，进阶能力以开关方式暴露

---

## 一键预设

- 新手（稳）：`strict + temp 0.10 + top_p 0.80`
- 进阶（推荐）：`balanced + temp 0.15 + top_p 0.85`
- 硬核（最严）：`strict + temp 0.08 + top_p 0.75`

> 建议区间：`temperature 0.10 ~ 0.20`，`top_p 0.70 ~ 0.95`。

---

## 核心字段

### 叙述者配置

- `narrator.systemPromptTemplate`：系统角色合同模板（可编辑，可重置）
- `narrator.guardPromptTemplate`：自定义 guard 包裹模板
- `narrator.responseMode`：`text` 或 `json`
- `narrator.provider`：模型供应商标识
- `narrator.maxTokens`：每次回复 token 上限
- `narrator.axiomInjectEnabled`：是否注入公理
- `narrator.axiomMaxCount`：每回合最多注入公理数

### 游戏配置

- `game.axioms`：核心公理列表
- `game.hooks.onPlayerInput`：输入预处理 Hook
- `game.hooks.onAIOutput`：输出后处理 Hook

---

## 模板占位符

- `{{DEFAULT_GUARD}}`：注入系统生成的默认约束规则
- `{{SYSTEM_PROMPT_TEMPLATE}}`：注入系统角色合同模板

推荐写法：

```text
【自定义前置说明】
{{SYSTEM_PROMPT_TEMPLATE}}

【运行时约束】
{{DEFAULT_GUARD}}

【补充规则】
1. ...
2. ...
```

---

## responseMode 使用建议

### `text`（默认，稳定）

- 适合 7B~9B、小模型和混合供应商环境
- 调试成本低，容错高

### `json`（高级，严格）

- 适合高服从模型和明确 schema 场景
- 若解析失败，系统会自动回退 `text` 并给出提示

---

## Hook 使用建议

- 输入 Hook 用于同义词替换、口癖归一化、敏感词预处理
- 输出 Hook 用于兜底过滤、格式修正、风格统一
- Hook 在安全层执行（关键词黑名单 + 只读上下文 + 长度限制）

---

## 推荐组合

### 新手作者

- 选择预设“进阶（推荐）”
- `responseMode=text`
- 公理控制在 6~10 条

### 进阶作者

- 开启公理注入 + 限制条数
- 使用 `{{DEFAULT_GUARD}} + {{SYSTEM_PROMPT_TEMPLATE}}`
- 输入/输出 Hook 做细粒度收敛

### 硬核作者

- 尝试 `responseMode=json`
- 自定义 guard 模板 + 本地先判定
- 强化边界事件协议（如 `[CALL_TIAN_DAO]`）

---

## 常见误区

- 只调温度，不做模板和本地规则
- 公理写成剧情细节而非不可违背原则
- 在 Hook 里直接修改全局状态（不建议）
- JSON 模式没给 schema 还要求严格输出

