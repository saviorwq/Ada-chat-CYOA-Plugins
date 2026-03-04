<div align="center">

# CYOA 文字冒险游戏插件

**面向 Ada Chat 的 AI 叙事沙盒 + 可视化剧本编辑器**

<p>
  <a href="https://github.com/saviorwq/Ada-chat-CYOA-Plugins"><img src="https://img.shields.io/badge/Repo-Ada--chat--CYOA--Plugins-111827?style=for-the-badge&logo=github" alt="repo"></a>
  <img src="https://img.shields.io/badge/Version-2.2.1-10b981?style=for-the-badge" alt="version">
  <img src="https://img.shields.io/badge/Language-简体中文-orange?style=for-the-badge" alt="language">
  <img src="https://img.shields.io/badge/Architecture-Modular-6366f1?style=for-the-badge" alt="architecture">
</p>

从“写设定”到“实时游玩”，一套插件完成：  
**编辑世界 → 约束 AI → 进入游戏 → 持续调试与迭代。**

</div>

---

## 目录

- [项目定位](#项目定位)
- [核心特性](#核心特性)
- [安装与快速开始](#安装与快速开始)
- [给游戏作者：约束工具箱](#给游戏作者约束工具箱)
- [运行时机制](#运行时机制)
- [侧栏与调试面板](#侧栏与调试面板)
- [模块结构](#模块结构)
- [存储与容错策略](#存储与容错策略)
- [发布打包](#发布打包)
- [文档与 Wiki](#文档与-wiki)
- [FAQ](#faq)
- [开发建议](#开发建议)

---

## 项目定位

`CYOA`（Choose Your Own Adventure）不是单纯聊天皮肤，而是完整玩法层：

- **剧情层**：章节、场景、地点、任务、状态推进
- **交互层**：四选项、方向控制、可互动对象
- **规则层**：装备约束、材质反馈、锁钥/契约联动
- **AI 层**：模板约束、公理注入、漂移收敛、本地安全 Hook、参数调优

> 设计目标：**你负责搭架子，作者负责定规则，玩家负责体验。**

---

## 核心特性

### 1) 可视化创作

- 编辑：属性、物品、装备、技能、任务、角色、场景、章节、地点、世界观
- 地图：`locationEdges` 连边、旅行回合、受限步态额外回合
- 装备叙事：拘束类与防护类分流，支持附件联动（振动/电击/充气/真空等）

### 2) 实时叙事

- 流式回复（SSE）
- 固定四选项（2 行动 + 2 对话）
- 可互动面板（NPC/设施）
- 地图快速到达（已知地点）

### 3) AI 约束能力（已落地）

- 系统约束模板（可重置默认模板）
- 约束预设：新手 / 进阶 / 硬核（一键应用）
- 动态公理注入（开关 + 条数上限）
- `responseMode`：`text/json`（JSON 失败自动回退）
- 本地纠偏收敛（不走额外 AI 纠偏重试）
- Hook 扩展点：`onPlayerInput` / `onAIOutput`（含安全执行层）
- 统一请求适配：`provider` + `max_tokens`

### 4) 模块化维护

- `cyoa-game.js` 已收敛为兼容层
- 主逻辑拆分到多文件，降低单文件体积和编辑器压力

---

## 安装与快速开始

### 安装

1. 将 `plugins/cyoa/` 放入 Ada Chat 的 `plugins/`
2. 确认 `manifest.json` 已包含模块文件列表
3. 在插件管理启用 **CYOA 文字冒险游戏**

### 快速开始（5 分钟）

1. 打开插件设置，创建/导入一个游戏
2. 最少配置：
   - 1 个章节
   - 1 个地点
   - 1 个场景（建议绑定章节+地点）
   - 玩家角色
3. 在“叙述者设定”选择模型并保存
4. 进入游戏，发送输入验证回包与四选项

---

## 给游戏作者：约束工具箱

推荐先看完整文档：  
- [约束工具箱作者指南](./cyoa-constraint-authoring-guide.md)
- [AI 示例集合](./cyoa-ai-constraints-examples.md)

### 一键预设

- 新手（稳）：`strict + temp 0.10 + top_p 0.80`
- 进阶（推荐）：`balanced + temp 0.15 + top_p 0.85`
- 硬核（最严）：`strict + temp 0.08 + top_p 0.75`

### 关键字段（作者常用）

- `game.axioms`
- `narrator.systemPromptTemplate`
- `narrator.axiomInjectEnabled`
- `narrator.axiomMaxCount`
- `narrator.guardPromptTemplate`
- `narrator.responseMode`
- `narrator.provider`
- `narrator.maxTokens`
- `game.hooks.onPlayerInput`
- `game.hooks.onAIOutput`

### 最小可用配置示例

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

---

## 运行时机制

### 输入帧（严格）

发送给 AI 的上下文包含：

- 当前章节、地点、区域
- 在场角色与角色档案约束
- 玩家状态（姿态/技能/任务/属性/装备/限制）
- 世界设定（故事简介、世界观、背景）
- RAG 摘要 + 最近历史

### 选项机制

- 始终收敛为 4 项（2 行动 + 2 对话）
- 支持约束改写（例如受限动作改写为可执行替代）

### 漂移收敛

- 章节偏航、地点偏航、人物越界、框架越界、动作扩写
- 统一走本地收敛重写（避免多轮重试 token 消耗）

---

## 侧栏与调试面板

右侧顶层折叠面板常见包含：

- 故事 / 属性 / 状态 / 物品
- 地图
- AI 实时调试
- 技能 / 任务 / 章节 / 存档

重点：

- **地图**：按区域分组、显示 ETA、仅展示已知地点
- **AI 实时调试**：支持新增/清空/导入/导出/保存调优规则

---

## 模块结构

主要加载顺序见 `manifest.json`，关键模块如下：

```text
cyoa-core.js                       核心配置与默认结构
cyoa-core-settings.js              插件设置读写（温度/TopP/预设等）
cyoa-data.js                       数据读写（后端优先，可选本地回退）
cyoa-editor.js                     编辑器渲染与保存
cyoa-game-runtime.js               回合、旅行、存档等运行时逻辑
cyoa-game-ai.js                    AI 请求辅助
cyoa-game-prompts.js               约束模板与 guard 生成
cyoa-game-rules.js                 行动/选项约束改写
cyoa-game-ui.js                    游戏 UI 与消息主流程
cyoa-main-settings.js              设置页渲染（已拆分）
cyoa-main-sidebar-*.js             右侧栏模块（已拆分）
cyoa-main.js                       主入口与编辑器总控
```

> 建议：新功能优先新建模块，旧文件仅做最小挂接。

---

## 存储与容错策略

- 保存优先后端 API（JSON）
- `localStorage` 回退为可选项（默认关闭）
- 回退建议仅用于后端故障排查

---

## 发布打包

- 产物目录：`plugins/cyoa/release/`
- 建议同时提供：
  - `cyoa-plugin.zip`
  - `cyoa-plugin.tar.gz`
- 发布前请先勾选：[发版前回归清单](./cyoa-release-smoke-checklist.md)

---

## 文档与 Wiki

- Wiki 首页：[`wiki/Home.md`](./wiki/Home.md)
- 约束工具箱：[`wiki/Constraint-Toolkit.md`](./wiki/Constraint-Toolkit.md)
- 架构说明：[`wiki/Architecture.md`](./wiki/Architecture.md)
- 发布说明：[`wiki/Publishing.md`](./wiki/Publishing.md)
- 发版检查：[`wiki/Release-Checklist.md`](./wiki/Release-Checklist.md)

---

## FAQ

### Q1: 保存失败怎么办？

优先查看弹窗中的后端错误信息。若后端不可用，可临时开启 `localStorage` 回退。

### Q2: AI 不按章节/地点叙事？

检查：

- 当前章节、地点、场景是否完整
- 在场角色是否正确
- 公理与世界设定是否互相冲突
- 约束档位是否过于宽松

### Q3: JSON 模式不稳定？

先切回 `text` 验证链路，再逐步恢复 `json`，并补充严格输出示例。

---

## 开发建议

- 提交前至少验证：进入游戏 / 对话 / 保存 / 读取 / 地图跳转 / 选项渲染
- AI 逻辑尽量拆分：约束规则 vs 提示词规则
- UI 调整后务必走一次“受限状态 + 开场叙述”回归

---

## 致谢

- Ada Chat 插件系统
- CYOA 创作者与测试反馈用户

如果这个项目帮到了你，欢迎点一个 Star。
