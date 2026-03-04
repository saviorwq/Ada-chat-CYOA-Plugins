# 架构说明

本文描述 CYOA 插件在“纯客户端运行”前提下的模块边界与主数据流。

---

## 设计目标

- 运行时逻辑全部在玩家浏览器执行
- 插件开发者只提供框架，不绑定单一模型供应商
- 游戏作者通过 JSON + 编辑器配置约束 AI 行为
- 高风险行为优先本地判定，AI 仅做叙事表达

---

## 分层结构

### 配置层

- `cyoa-core.js`
- `cyoa-core-settings.js`

职责：

- 默认配置与默认游戏结构
- 插件设置读取/归一化/持久化
- 温度、Top P、约束档位等全局策略

### 数据层

- `cyoa-data.js`

职责：

- 游戏数据读取、保存、列表管理
- 后端优先与可选本地回退策略

### 编辑层

- `cyoa-editor.js`
- `cyoa-main-settings.js`

职责：

- 可视化编辑器渲染与保存
- 叙述者配置（模板、公理、provider、token 等）
- 约束预设应用与 UI 联动

### 运行时层

- `cyoa-game-runtime.js`
- `cyoa-game-systems.js`
- `cyoa-game-constraints.js`
- `cyoa-game-rules.js`

职责：

- 回合推进、状态更新、旅行耗时计算
- 装备/材质/附加系统联动
- 约束解析、动作改写、先判定逻辑

### AI 与提示词层

- `cyoa-game-prompts.js`
- `cyoa-game-ai.js`
- `cyoa-game-ui.js`

职责：

- 系统角色合同模板渲染
- guard 规则拼装与约束档位应用
- 多供应商请求体适配与回复解析
- `responseMode=text/json` 分流与回退

### 兼容层

- `cyoa-game.js`
- `cyoa-main.js`

职责：

- 保持既有入口兼容
- 汇总模块挂接，避免单文件膨胀

---

## 运行时主流程（简化）

1. 玩家输入  
2. 本地预处理（`onPlayerInput`）  
3. 本地规则先判定（允许/阻断/改写）  
4. 组装 system prompt（合同模板 + guard + 公理 + 上下文）  
5. 调用 AI（携带 provider/max_tokens/temperature/top_p）  
6. 解析输出（`text/json`）  
7. 本地后处理（`onAIOutput`）  
8. 应用允许的状态变更并渲染 UI  

---

## 扩展建议

- 新功能优先新增 `cyoa-game-*.js` 文件，不在大入口堆叠
- 规则引擎与提示词引擎分离，便于定位漂移来源
- 文档与 UI 字段保持同名，降低作者学习成本
