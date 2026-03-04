# 发布说明

本文用于规范 CYOA 插件的发版动作，确保“可下载、可验证、可回滚”。

---

## 发布目标

每次发版至少产出：

- `zip`（Windows 友好）
- `tar.gz`（Linux/macOS 友好）

并附带可追溯的文档入口与回归范围说明。

---

## 产物位置

- `plugins/cyoa/release/cyoa-plugin.zip`
- `plugins/cyoa/release/cyoa-plugin.tar.gz`

---

## 建议流程

1. 先执行 [发版检查清单](./Release-Checklist.md)
2. 再执行 [发版前回归清单](../cyoa-release-smoke-checklist.md)
3. 生成并验证 `zip + tar.gz`
4. 上传 Release 产物并填写版本说明
5. 同步 `README` 与 `Wiki` 导航入口

---

## 版本说明模板（可复制）

```text
## 版本亮点
- ...
- ...

## 约束能力
- 模板/公理/Hook/responseMode 的变化点

## 回归范围
- 进入游戏、开场叙述、四选项、地图、保存读取、JSON 回退

## 下载
- cyoa-plugin.zip
- cyoa-plugin.tar.gz
```

---

## 协作者提示

- 主要在 Windows 使用：优先 `zip`
- Linux/macOS 或脚本处理：优先 `tar.gz`
- 若反馈“运行异常”，请一并提供版本号与浏览器控制台报错
