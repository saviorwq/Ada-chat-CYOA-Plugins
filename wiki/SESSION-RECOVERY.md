# 会话恢复锚点（Session Recovery）

> 目的：当 Cursor 意外重启、白板、上下文丢失时，10 秒恢复到可继续开发状态。

---

## 1. 项目根目录（必须从这里打开）

`G:\AdaChat Backup\AdaChat-Release\plugins\cyoa`

---

## 2. 本次工作主线（当前）

- 目标：重写并美化 `README` 与 `Wiki` 文档体系
- 已完成：
  - `README.md`：已重写为发布级结构（作者/玩家双视角、快速开始、约束工具箱、模块结构、FAQ）
  - `wiki/Home.md`：已升级为导航首页（文档入口 + 推荐阅读顺序）
  - `wiki/Constraint-Toolkit.md`：已扩展为可直接给作者使用的约束手册
  - `wiki/Architecture.md`：已补齐分层结构与运行时主流程
  - `wiki/Publishing.md`：已补齐发布流程与版本说明模板
  - `wiki/Release-Checklist.md`：已补齐分组检查项
- 进行中：
  - 文档互链与术语一致性复查

---

## 3. 下一步待办（恢复后直接做）

1. 统一检查所有文档互链是否可用
2. 按需补充截图或示例 JSON
3. 完成文档提交与推送（不包含 `release/`）
4. 按版本号重新生成并上传发版压缩包

---

## 4. 意外重启后的恢复步骤

1. `File -> Open Folder...` 打开项目根目录（见第 1 节）
2. `Developer: Reload Window`
3. 打开本文件 `wiki/SESSION-RECOVERY.md`
4. 按“第 3 节下一步待办”继续执行

---

## 5. 发布相关路径

- 发布产物目录：`release/`
- 文档入口：
  - `README.md`
  - `wiki/Home.md`
  - `wiki/Constraint-Toolkit.md`
  - `wiki/Publishing.md`
  - `wiki/Release-Checklist.md`

---

## 6. 约定（防止再次丢状态）

- 每完成一个文档页面，立即保存并更新本锚点
- 不依赖会话记忆，关键进度只认文件落地
- 大改动采用“小步提交 + 可回滚”策略
