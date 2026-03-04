# CYOA AI 约束示例（可复制即用）

> 目标：给“搭框架”的作者一套开箱即用示例，玩家可按自己模型自由微调。

---

## 1) 推荐基础配置（温度 + 档位）

```json
{
  "AI_CHAT_TEMPERATURE": 0.15,
  "AI_GUARD_PROFILE": "strict",
  "AI_DEFINITION_HEARTBEAT_TURNS": 6
}
```

- 温度建议区间：`0.10 ~ 0.20`
- 免费小模型（7B-9B）建议先从 `strict + 0.15` 开始

---

## 2) narrator 配置示例（text/json）

```json
{
  "narrator": {
    "prompt": "你是该世界的叙述者，必须严格遵守设定边界。",
    "responseMode": "text",
    "guardPromptTemplate": ""
  }
}
```

- `responseMode`:
  - `text`：默认稳定
  - `json`：高级模式，模型必须严格返回 JSON 对象

---

## 3) 自定义 Guard 模板（含 {{DEFAULT_GUARD}}）

```text
【你的身份】
你是该世界的叙述者，不可越权改写已存在设定。

【硬规则】
{{DEFAULT_GUARD}}

【额外限制】
1) 不得扩写玩家未输入的“已执行动作”。
2) 不得把角色做不到的行为写成已发生。
3) 如遇世界级裁决，使用边界协议。
```

说明：
- 建议始终保留 `{{DEFAULT_GUARD}}`，避免自定义模板把底层约束覆盖掉。

---

## 4) onPlayerInput 示例（输入预处理）

把以下字符串放到 `game.hooks.onPlayerInput`（或 `game.narrator.hooks.onPlayerInput`）：

```javascript
function(input, ctx) {
  const action = String(input?.action || "").trim();
  const speech = String(input?.speech || "").trim();
  const active = new Set((ctx?.activeConstraints || []).map(String));

  // 示例 A：被堵嘴时，不禁止发言，自动转为呻吟声
  if (speech && active.has("gagged")) {
    return { action, speech: "呜呜……（被口枷阻断，无法清晰发音）" };
  }

  // 示例 B：手指被限制时，拦截“写字/精细操作”类动作
  if (action && (active.has("no_fingers") || active.has("no_hands"))) {
    if (/(写字|书写|解锁|拆解|精细操作|typing|write|unlock)/i.test(action)) {
      return {
        action: "尝试动作失败（当前拘束状态不允许该精细操作）",
        speech
      };
    }
  }

  return { action, speech };
}
```

---

## 5) onAIOutput 示例（输出后处理）

把以下字符串放到 `game.hooks.onAIOutput`（或 `game.narrator.hooks.onAIOutput`）：

```javascript
function(text, ctx) {
  let out = String(text || "");

  // 去掉模型自述类污染
  out = out.replace(/(作为AI|我不能|I cannot|policy|审查|过滤器)/gi, "");

  // 可选：统一语气（示例）
  out = out.replace(/你可以试试/g, "你可尝试");

  return out.trim();
}
```

---

## 6) 边界事件协议示例（CALL_TIAN_DAO）

当 NPC 模型遇到“超出在场角色权限”的事件，可输出：

```text
[CALL_TIAN_DAO] 请求天道裁决：玩家试图直接改写世界规则
```

前端会将其转为“天道裁决中”的过渡叙事与可选项，不会空白卡死。

---

## 7) JSON 模式返回示例（responseMode=json）

模型应只返回一个 JSON 对象：

```json
{
  "narrative": "你缓慢转身，目光扫过潮湿石壁，火把在远处轻微摇曳。",
  "options": [
    { "type": "action", "label": "靠近火把观察墙面刻痕" },
    { "type": "action", "label": "后退两步，检查地面痕迹" },
    { "type": "dialogue", "label": "低声询问：这里有人吗？" },
    { "type": "dialogue", "label": "自语：先确认出口方向。" }
  ],
  "cyoa_changes": {
    "state": { "sanity": -1 },
    "flags": { "entered_ruin_hall": true }
  }
}
```

注意：
- 禁止输出代码块、解释文字、前后缀闲聊。
- 若模型没按 JSON 返回，系统会自动回退 text（仅本回合）。

---

## 8) 最小组合建议（给 7B-9B）

- `AI_GUARD_PROFILE = strict`
- `AI_CHAT_TEMPERATURE = 0.15`
- `responseMode = text`（先稳定再切 json）
- 保留 `{{DEFAULT_GUARD}}`
- 只启用 1~2 个 hook，先小步验证再叠加

---

## 9) 快速排错

1. 先切 `responseMode = text`
2. 再切 `AI_GUARD_PROFILE = strict`
3. 临时清空自定义 `guardPromptTemplate`
4. 临时关闭 hooks，逐个恢复定位问题

