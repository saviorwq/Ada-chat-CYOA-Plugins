<div align="center">

# ✦ CYOA 文字冒险游戏插件 ✦

**为 [Ada Chat](https://ada-fm.com) 打造的 AI 驱动互动叙事引擎**

*每个选择都通往不同的故事，每个 NPC 都由 AI 即兴演绎。*

<br/>

[![Version](https://img.shields.io/badge/version-2.2.0-10b981?style=for-the-badge)](https://github.com/saviorwq/Ada-chat-CYOA-Plugins)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)
[![i18n](https://img.shields.io/badge/i18n-简体中文-orange?style=for-the-badge)](./cyoa-i18n-zh.js)
[![Systems](https://img.shields.io/badge/systems-43+-purple?style=for-the-badge)](#系统架构)

<br/>

[安装](#-安装) · [特性](#-核心特性) · [AI 创作](#-ai-创作) · [道道设定](#-道道--世界观扩展) · [文件结构](#-文件结构)

</div>

---

## 🌟 概述

**CYOA**（Choose Your Own Adventure）将 **AI 驱动的动态剧情** 与 **精密物理模拟** 融合，在浏览器中即可：

- ✨ **AI 智能创建** — 一句创意或粘贴规则书，自动生成完整游戏
- 🎭 **手动创作** — 可视化编辑器，14 个分节，9 类游戏元素
- 🎮 **即时游玩** — 流式 AI 响应，选择即剧情
- 📖 **深度沉浸** — 43+ 子系统，从 RPG 到感官约束全覆盖
- 🔌 **角色独立 AI** — 为每个 NPC 指定不同模型，关键角色用大模型、路人用轻量

> **核心理念**：你设计的角色，由你选择的 AI 扮演。人设、性格、行为规则——AI 即兴演绎，动态生成剧情与选项。

---

## ✨ 核心特性

<table>
<tr>
<td width="50%">

### 🤖 AI 叙事引擎
- 每个 NPC **独立指定 AI 模型**
- SSE 流式响应、RAG 知识库、滚动摘要
- Token 预算、150+ 敏感词双向过滤

### 🎨 游戏编辑器
- 9 类元素：属性/物品/装备/技能/任务/角色/场景/章节
- 25 装备部位 × 10 约束 × 6 级锁定
- 世界观、核心机制、叙述者风格

### ⚔️ RPG 基础
- 属性 / 10 种物品 / 25 装备部位
- 6 种技能 × 9 级 / 6 种任务 / 20 种职业
- 章节推进、解锁条件

</td>
<td width="50%">

### 🔗 约束与感官
- 10 种约束：目盲/禁言/限步/缚手/贞操/牵引…
- 27 种姿势、4 种牵引类型
- 挣扎逃脱、耐久降级

### 🌡️ 状态系统
- 兴奋度/羞耻/氧气/恐慌/习惯度
- 乳胶封闭 13 子系统
- PetPlay / 家具化 / 训练纪律

### 💾 存储与安全
- 服务端 API 优先，localStorage 回退
- 存档导入/导出/另存为

</td>
</tr>
</table>

---

## ✨ AI 创作

| 功能 | 说明 |
|------|------|
| **AI 智能创建** | 游戏库中「✨ AI 智能创建」，输入创意或粘贴规则书，一键生成游戏配置 |
| **创意模式** | 一句话描述（如「修仙世界里的赛博朋克密室逃脱」），AI 自由发挥 |
| **规则书模式** | 粘贴详细规则说明书，AI 严格按文档解析并转为 JSON，准确性更高 |
| **超长分块** | 规则书 >8000 字时自动分两段处理，先建基础再合并补充 |
| **AI 写作助手** | 编辑器内「✨ AI 扩展」按钮，将世界观/叙述者等简短描述扩展为详细段落 |
| **Story Cards** | FictionLab 风格 lore 触发卡，对话出现触发词时自动注入设定，最多 3 张同启 |

---

## 🏮 道？道！ 世界观扩展

专为融合世界题材设计：

| 模块 | 说明 |
|------|------|
| **八大天道** | 🔬 K-科学 · ⚙️ J-机械 · ✨ M-魔法 · 💋 Q-情色 · 🐙 C-克系 · 🔄 G-诡异 · 📐 Z-哲学 · ⚔️ X-仙侠 |
| **派系相容性** | 天道间 0–75% 相容度 |
| **遗物等级** | S 级稳定 / A 级活性 / EX 级悖论 |
| **人性平衡协议** | 人性指数与神性权限，4 级封锁 |
| **世界规则标签** | 为游戏/角色打标签，AI 按规则演绎 |
| **融合世界** | 多规则并存，道纹复合形态 |

---

## 🚀 安装

```bash
git clone https://github.com/saviorwq/Ada-chat-CYOA-Plugins.git
# 将 cyoa/ 复制到 Ada Chat 的 plugins/
# 启用插件「CYOA 文字冒险游戏」
```

> 若后端不可用，插件会**自动降级到 localStorage**。

---

## 📁 文件结构

```
cyoa/
├── manifest.json        # 插件清单
├── cyoa-core.js         # 核心配置、43 系统定义
├── cyoa-data.js         # 数据管理、API
├── cyoa-editor.js       # 游戏编辑器
├── cyoa-game.js         # 游戏引擎、AI 交互
├── cyoa-main.js         # 入口、侧边栏、AI 创建 UI
├── cyoa-i18n-zh.js      # 简体中文（350+ 键）
├── cyoa.css             # 样式
├── backend.php          # 后端 CRUD
└── cyoa_games/          # 游戏数据（运行时创建）
```

---

## 📖 文档导航

<details>
<summary><b>展开：完整系统说明（43+ 子系统）</b></summary>

### AI 叙事 · 游戏编辑器 · RPG 基础 · 约束与感官 · 生理状态 · 乳胶封闭 · 角色扮演 · 训练与纪律 · 打击与温度 · 监控 · 存储与安全

（详见仓库内详细文档）

</details>

---

<div align="center">

**[Ada Chat](https://ada-fm.com)** · [仓库](https://github.com/saviorwq/Ada-chat-CYOA-Plugins)

**MIT License** · Ada Chat 社区维护

</div>
