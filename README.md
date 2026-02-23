# CYOA 文字冒险游戏插件

> Ada Chat 插件 — 创建并游玩你自己的 Choose Your Own Adventure 游戏。

## 特性

- **游戏编辑器**：可视化创建属性、物品、装备、技能、任务和章节
- **AI 驱动剧情**：流式响应，自动选项提取，滚动摘要记忆
- **物理约束系统**：限步、缚手、目盲、禁言等多维约束
- **状态系统**：兴奋度、羞耻、氧气、疼痛、温度等实时追踪
- **监控 / CCTV**：场景内警觉度与安保介入机制
- **存档管理**：服务端 API 优先，自动回退 localStorage
- **多语言**：简体中文 / English

## 安装

1. 将 `cyoa/` 目录复制到 Ada Chat 的 `plugins/` 文件夹。
2. 确保 Web 服务器对 `cyoa/cyoa_games/` 目录可写（后端存储需要）。
3. 在 Ada Chat 插件管理中启用 **CYOA 文字冒险游戏**。

## 文件结构

| 文件 | 说明 |
|---|---|
| `cyoa-core.js` | 全局对象、CONFIG 常量、工具函数 |
| `cyoa-data.js` | 数据管理：API 调用、localStorage、存档 |
| `cyoa-editor.js` | 游戏编辑器 UI |
| `cyoa-game.js` | 游戏引擎：AI 交互、状态、装备、技能 |
| `cyoa-main.js` | 入口：插件注册、面板渲染 |
| `cyoa-i18n-zh.js` | 简体中文翻译字典 |
| `backend.php` | 后端 CRUD（由 `api.php` 加载） |
| `cyoa.css` | 样式 |

## 后端 API

所有请求通过 Ada Chat 的 `api.php` 路由，`PLUGIN_ACTION` 取值：

| Action | 方法 | 参数 | 说明 |
|---|---|---|---|
| `save_game` | POST | JSON body `{id, ...}` | 保存游戏数据 |
| `load_game` | GET | `?id=xxx` | 加载游戏 |
| `list_games` | GET | — | 列出所有游戏摘要 |
| `delete_game` | POST | JSON body `{id}` | 删除游戏 |

## 游戏数据格式

```json
{
  "id": "game_1234",
  "name": "我的冒险",
  "author": "作者",
  "attributes": [...],
  "items": [...],
  "equipment": [...],
  "skills": [...],
  "quests": [...],
  "chapters": [...],
  "characters": [...],
  "scenes": [...]
}
```

## 配置

核心配置位于 `cyoa-core.js` 的 `CONFIG` 对象，包含：

- `STORAGE_KEYS` — localStorage 键名
- `DEFAULT_GAME` — 新游戏默认结构
- `MATERIAL_TEMPLATES` — 装备材质模板
- `OBSERVER_ALERT_CONFIG` — 监控警觉度配置
- `MEMORY_CONFIG` — 对话摘要压缩策略

## 许可证

MIT
