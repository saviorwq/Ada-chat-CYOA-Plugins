# CYOA JSON Strict Output Contract

本文件用于约束其他 AI 生成“可直接导入 CYOA 插件”的纯 JSON 数据。

## 1) 输出硬性要求

- 只能输出一个 JSON 对象。
- 不允许输出 Markdown 代码块标记（如 ```json）。
- 不允许输出任何注释（`//`、`/* */`）和解释文字。
- 不允许省略根字段：`id`、`name`、`chapters`、`scenes`、`locations`、`initialChapter`。
- 所有 ID 仅允许字符：`[A-Za-z0-9_-]`。
- 所有引用必须可解析（如 `scene.chapterId` 必须存在于 `chapters[].id`）。

## 2) 根字段最小清单（必须存在）

- `id`: string
- `name`: string
- `author`: string
- `version`: string
- `synopsis`: string
- `worldSetting`: object
- `humanityBalanceEnabled`: boolean
- `coreMechanics`: object
- `characters`: array
- `scenes`: array
- `chapters`: array
- `attributes`: array
- `items`: array
- `equipment`: array
- `contracts`: array
- `professions`: array
- `skills`: array
- `quests`: array
- `locations`: array
- `locationEdges`: array
- `worldMap`: object or null
- `equipmentSynergies`: array
- `discoveryRules`: array
- `outfitPresets`: array
- `axioms`: array
- `rules`: object
- `narrator`: object
- `storyCards`: array
- `initialScene`: string
- `initialChapter`: string
- `createdAt`: ISO string
- `updatedAt`: ISO string

## 3) 关键一致性约束（必须满足）

- `initialChapter` 必须命中 `chapters[].id`。
- `initialScene` 若非空，必须命中 `scenes[].id`。
- 每个 `scene.chapterId` 必须命中 `chapters[].id`。
- 每个 `scene.location` 必须命中 `locations[].id`。
- 每个 `locationEdges[].from/to` 必须命中 `locations[].id`。
- `worldMap.regions[].locationIds[*]` 必须命中 `locations[].id`。
- `chapters[].scenes[*]` 若是字符串，必须命中 `scenes[].id`。
- `equipmentSynergies[].triggers[*]` 必须命中 `equipment[].id`。
- `outfitPresets[].items[*]` 必须命中 `equipment[].id`。
- `outfitPresets[].chapter` 若非空，必须命中 `chapters[].id`。

## 4) 推荐枚举值（避免兼容问题）

- `items[].itemType`: `common | quest | consumable | key | map | relic | healing | damage | fuel | repair | equipment`
- `characters[].roleType`: `playable | npc`
- `narrator.responseMode`: `text | json`
- `worldSetting.lexiconMode`: `auto | modern | ancient`

## 5) 失败兜底策略（生成模型必须执行）

- 若无法确定某字段，填入类型安全默认值，而不是省略字段。
- 若无法建立引用，先生成占位对象并补全其 `id`，确保引用闭合。
- 禁止输出 `null` 给这些字段：`id`、`name`、`initialChapter`、`chapters`、`scenes`、`locations`。

## 6) 交付前自检清单（模型内部执行）

- JSON 语法有效（可被 `JSON.parse` 通过）。
- 所有数组字段均为数组，不是对象或字符串。
- 每个对象均有稳定 `id`（能有就有，尤其 chapters/scenes/locations/items/equipment）。
- 时间字段为 ISO 格式（`YYYY-MM-DDTHH:mm:ss.sssZ`）。
- 不包含注释、不包含多余文字。

## 7) 输出模板指令（可直接贴给其他 AI）

请严格输出一个“可直接导入 CYOA 插件”的纯 JSON 对象，必须满足：

1. 不要输出任何解释文字、不要 Markdown 代码块、不要注释。  
2. 字段必须覆盖本规约第 2 节全部根字段。  
3. 必须满足本规约第 3 节全部引用一致性约束。  
4. 若信息不足，用类型安全默认值补齐，不允许缺字段。  
5. 输出结束于 JSON 末尾右花括号，不要附加任何内容。  

