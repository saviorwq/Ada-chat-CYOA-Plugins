# CYOA Wiki

欢迎来到 CYOA 插件知识库。  
这里面向两类人：

- **框架开发者**：维护插件本体、保证稳定与可扩展
- **游戏作者**：基于插件创作世界观、规则和 AI 叙事体验

---

## 文档导航

- [约束工具箱](./Constraint-Toolkit.md)
- [架构说明](./Architecture.md)
- [发布说明](./Publishing.md)
- [发版检查清单](./Release-Checklist.md)
- [会话恢复锚点](./SESSION-RECOVERY.md)
- [约束工具箱作者指南（仓库文档）](../cyoa-constraint-authoring-guide.md)
- [发版前回归清单（仓库文档）](../cyoa-release-smoke-checklist.md)

---

## 当前版本重点

- 系统约束模板与编辑器联动（支持重置默认模板）
- 约束预设（新手/进阶/硬核）与温度/Top P 配置联动
- 动态公理注入（开关 + 条数上限）
- Hook 安全执行层（关键词黑名单 + 只读上下文）
- 统一 AI 请求适配（`provider` + `max_tokens`）
- `responseMode=text/json` 与 JSON 失败自动回退

---

## 推荐阅读顺序

1. 先看 [约束工具箱](./Constraint-Toolkit.md) 建立参数与约束概念  
2. 再看 [架构说明](./Architecture.md) 理解模块边界与数据流  
3. 最后看 [发布说明](./Publishing.md) + [发版检查清单](./Release-Checklist.md)  

---

## 发布产物位置

- `../release/cyoa-plugin.zip`
- `../release/cyoa-plugin.tar.gz`

