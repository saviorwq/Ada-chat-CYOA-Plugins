# CYOA Plugin v2.2.1 Release Notes

发布日期：2026-03-04  
发布仓库：`saviorwq/Ada-chat-CYOA-Plugins`

---

## 本次版本重点

- 文档体系升级：`README` 与 `Wiki` 全面整理，结构更清晰，协作者接入更快。
- 约束工具箱文档完善：补充了模板占位符、公理注入、`responseMode`、Hook 安全策略等说明。
- 发布流程文档完善：发版入口、检查清单、产物说明统一到文档体系中。

---

## 运行与约束能力（本版本可用）

- AI 约束预设：新手 / 进阶 / 硬核
- 参数调优：`temperature`、`top_p`（建议区间已文档化）
- 模板联动：`systemPromptTemplate`、`guardPromptTemplate`
- 公理注入：`axiomInjectEnabled` + `axiomMaxCount`
- 模式切换：`responseMode=text/json`，JSON 失败自动回退文本模式
- 扩展点：`onPlayerInput` / `onAIOutput`（安全执行层）
- 多供应商适配：`provider` + `max_tokens`

---

## 打包产物

- `cyoa_v2.2.1.zip`（Windows 友好）
- `cyoa_v2.2.1.tar.gz`（Linux/macOS 友好）

---

## 文档入口

- 主文档：`README.md`
- Wiki 首页：`wiki/Home.md`
- 约束工具箱：`wiki/Constraint-Toolkit.md`
- 架构说明：`wiki/Architecture.md`
- 发布说明：`wiki/Publishing.md`
- 发版检查清单：`wiki/Release-Checklist.md`
- 会话恢复锚点：`wiki/SESSION-RECOVERY.md`

---

## 升级建议

1. 升级后先按 `wiki/Release-Checklist.md` 走一轮检查。  
2. 新项目默认使用“进阶”预设，再按模型服从性微调温度与 Top P。  
3. 如需严格结构化输出，先在 `text` 模式完成链路验证，再切换 `json`。  
