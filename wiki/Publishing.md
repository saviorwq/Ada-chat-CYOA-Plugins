# 发布说明

## 目标

提供可直接分发的两种压缩包格式：

- `zip`（Windows 友好）
- `tar.gz`（Linux/macOS 友好）

## 产物位置

- `plugins/cyoa/release/cyoa-plugin.zip`
- `plugins/cyoa/release/cyoa-plugin.tar.gz`

## 发布流程（建议）

1. 先执行 [发版检查清单](./Release-Checklist.md)。
2. 再执行 [发版前回归清单](../cyoa-release-smoke-checklist.md)。
3. 上传 `release/` 下两个压缩包到 Release 页面。
4. 在发布说明中附上：
   - 约束工具箱文档入口
   - 示例配置入口
   - 本版本回归范围

## 协作者提示

- 如果协作者主要在 Windows 环境，优先下载 `zip`。
- 如果协作者在 Linux 服务器部署或脚本化处理，优先使用 `tar.gz`。
