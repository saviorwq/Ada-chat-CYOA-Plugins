# 密室·富豪的游戏（自动回归模板）

## 使用方式

把本模板当成“人工执行脚本”或“后续自动化脚本输入”：

1. 按 `Case ID` 顺序执行
2. 记录 `Expected` 与 `Actual`
3. 标记 `Pass/Fail`
4. 失败项直接回填到 JSON 的 `simulationData.ruleBindings` 或 `discoveryRules`

---

## Regression Cases

| Case ID | Category | Action | Expected |
|---|---|---|---|
| R-001 | UI | 发送任意行动 | 始终生成4选项 |
| R-002 | UI | 发送超长文本 | 选项宽度稳定，文本截断正常 |
| R-003 | Constraint | 穿戴 `eq_head_module` | 对话输入禁用 |
| R-004 | Constraint | 穿戴 `eq_hand_shell` 后尝试“拾/取/接/抛/扔” | 动作被改写 |
| R-005 | Constraint | 穿戴 `eq_vision_band` 后尝试“读唇” | 返回受限改写 |
| R-006 | Constraint | 穿戴 `eq_audio_muff` 后尝试听觉动作 | 返回受限改写 |
| R-007 | Travel | 受限状态移动 | ETA 增加 |
| R-008 | Travel | 快速地图跳转已知地点 | 成功并消耗回合 |
| R-009 | Discovery | 触发主街互动 | `poem_hint_a` 事件出现 |
| R-010 | Discovery | 触发采访角互动 | `poem_hint_b` 事件出现 |
| R-011 | Discovery | 触发警务终端互动 | `poem_hint_c` 事件出现 |
| R-012 | Morse | 输入错误短间隔 | `shortGapOverload` 反馈 |
| R-013 | Morse | 输入错误长间隔 | `longGapOverload` 反馈 |
| R-014 | Morse | 输入正确 `STUART` | `quest_exit_done` 推进 |
| R-015 | Attachment | `att_stim` 切换模式 | `stim_mode` 事件出现 |
| R-016 | Attachment | `att_shock` 切换模式 | `shock_mode` 事件出现 |
| R-017 | Attachment | `att_inflate` 改等级 | `inflate_level` 事件出现 |
| R-018 | Attachment | `att_temp` 切换 | `temp_mode` 事件出现 |
| R-019 | Attachment | `att_latex` 改参数 | `latex_layer` 事件出现 |
| R-020 | Narrative | 启用 `eq_guard_plate` 后叙事 | 优先防护语义，不走拘束语义 |
| R-021 | Drift | 人物越界测试 | 自动纠偏 |
| R-022 | Drift | 地点越界测试 | 自动纠偏 |
| R-023 | Drift | 章节越界测试 | 自动纠偏 |
| R-024 | Persistence | 保存并重载 | 任务/地点/状态一致 |
| R-025 | Contract | 非主奴契约尝试强制管理 | 不生效 |

---

## 失败项记录

| Case ID | Expected | Actual | Suspect Field | Fix Plan |
|---|---|---|---|---|
|  |  |  |  |  |

