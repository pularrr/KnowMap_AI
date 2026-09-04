# P3-5 + P3-6 开发报告：工作流文档完善 + 端到端验证与迭代

**日期**：2026-09-04
**阶段**：P3-5 工作流文档与插件完善 + P3-6 端到端验证与自举测试
**状态**：P3-5 已完成，P3-6 验证中（发现并修复多个问题）
**提交**：d74b5f4（P3-5）→ 5da0f81（修复JSON提取）→ fdf0e3d（优化提示词）

---

## 一、P3-5：工作流文档与插件完善

### 1.1 完成内容

#### plugin/SKILL.md 完善
增加端到端使用指引（7步流程），让其他 LLM 能够按照文档从零生成完整应用：
- Step 0: 确认主题和输出目录
- Step 1: 设计 Profile（不需要 API Key）
- Step 2: 生成项目骨架（不需要 API Key）
- Step 3: 实现核心代码（不需要 API Key）
- Step 4: 生成 MVP 知识网络（需要 API Key）
- Step 5: 用户确认与调整
- Step 6: 完整开发（需要 API Key）
- Step 7: 验证与交付

包含 package.json/schema.ts/validation.ts 等核心文件的代码模板。

#### 6 个工作流文档（plugin/workflows/）
1. profile-design-workflow.md - Profile 设计工作流
2. mvp-generation-workflow.md - MVP 生成工作流
3. full-development-workflow.md - 完整开发工作流
4. knowledge-ingest-workflow.md - 知识接入工作流
5. deep-search-workflow.md - 深度检索工作流
6. validation-workflow.md - 验证与迭代工作流

#### 2 个提示词模板（plugin/prompts/）
1. react-prompt-template.md - ReAct 提示词模板（含 MVP/完整开发模式追加）
2. ingest-prompts-template.md - 资料接入提示词模板（4 种资料类型）

#### 1 个激光雷达 Profile 示例（plugin/examples/）
- lidar-profile-example.ts - 激光雷达技术路线 Profile 示例
  - 7 个语义域（原理/光源/接收/信号处理/点云算法/系统集成/应用）
  - 6 个视觉分支
  - 11 种基础节点类型 + 12 种基础边类型 + 13 个基础栏目
  - 完整的提示词和初始化策略

### 1.2 API Key 使用原则
- 基准架构由豆包工作版根据 SKILL.md 生成（不需要 API Key）
- API Key 只用于 AI 应用中的功能验证（Profile 设计、知识生成）
- 避免在不必要的位置使用 API Key

---

## 二、P3-6：端到端验证与迭代

### 2.1 验证目标
用激光雷达技术路线作为评估题目，验证：
1. API 路由是否正确注册
2. Profile 设计器是否能正常工作
3. 知识生成器是否能正常工作
4. 发现问题并定位修复

### 2.2 验证过程与发现的问题

#### 问题 1：PowerShell 中文编码问题
**现象**：LLM 收到的主题是 "????????" 而不是 "激光雷达技术路线"
**根因**：PowerShell 的 `ConvertTo-Json` 将中文转换为 `?` 占位符
**修复**：创建 `scripts/test-profile-design.mjs` Node.js 测试脚本，避免编码问题
**状态**：已解决

#### 问题 2：LLM 输出无法提取 JSON
**现象**：`extractJSON` 抛出 "无法从 LLM 输出中提取 JSON"
**根因**：LLM 返回思考文本而不是纯 JSON
**修复**：
1. `extractJSON` 增加 5 种提取策略：
   - 策略 1：提取 ```json 代码块
   - 策略 2：提取第一个 { 到最后一个 }（支持嵌套）
   - 策略 3：提取第一个 [ 到最后一个 ]（数组）
   - 策略 4：清理 Markdown 标记后重试
   - 策略 5：修复常见 JSON 语法错误（尾随逗号、未加引号的 key）
   - 所有策略失败时打印原始输出用于调试
2. `designDomains` 增加重试机制（最多 2 次）
3. 增加容错：如果 domains 字段不存在，检查其他可能的域字段
**状态**：部分解决（提取策略增强，但 LLM 仍然返回思考文本）

#### 问题 3：LLM 仍然返回思考文本
**现象**：即使提示词明确要求直接输出 JSON，LLM 仍然先思考再输出
**根因**：deepseek-v4-flash-vision-exp 模型倾向于先思考再输出，这是模型行为问题
**修复**：
1. 优化提示词，明确 5 条输出要求：
   - 直接输出 JSON 对象，不要包含思考/解释/前缀/后缀
   - 不要使用 Markdown 代码块标记
   - 不要说过渡语
   - 输出第一个字符必须是 {，最后一个字符必须是 }
   - JSON 必须合法，可直接被 JSON.parse 解析
2. 修复模板字符串中的反引号语法错误
**状态**：验证中（模型行为问题，可能需要换模型或使用 chat/completions API）

### 2.3 已验证通过的项
- [x] tsc 类型检查通过
- [x] API 路由正确注册（/api/profile/design、/api/agent/generate 返回 400 而不是 404）
- [x] FMCW 零退化（现有代码不受影响）
- [x] 激光雷达 Profile 示例正确（tsc 通过）
- [x] PowerShell 中文编码问题已解决
- [x] extractJSON 提取策略增强

### 2.4 待验证/待优化的项
- [ ] Profile 设计器端到端功能（受 LLM 模型行为影响）
- [ ] 知识生成器端到端功能
- [ ] 完整开发模式（25-40 分钟）
- [ ] 自举测试（用插件生成一个新的插件）

---

## 三、后续优化方向

### 3.1 解决 LLM 输出格式问题
1. **换模型**：使用更听话的模型（如 deepseek-chat），而不是 deepseek-v4-flash-vision-exp
2. **换 API**：使用 chat/completions API 而不是 responses API，可能更容易控制输出格式
3. **使用 JSON mode**：如果模型支持，启用 JSON mode 强制输出 JSON
4. **后处理重试**：如果 LLM 输出了思考文本，自动提取 JSON 部分，或让 LLM 重新输出只包含 JSON
5. **few-shot 示例**：在提示词中加入完整的输入输出示例，让模型学习输出格式

### 3.2 增强 Profile 设计器
1. **分步骤用户确认**：域划分确认后再设计类型系统，避免累积错误
2. **增加 FMCW Profile 作为 few-shot 示例**：提高设计质量
3. **增加校验规则强度**：从 warning 升级为 error 强制修复
4. **增加后台任务支持**：完整开发模式（25-40 分钟）需要后台任务

### 3.3 增强知识生成器
1. **增加审查环节**：生成后自动审查节点粒度、栏目填充率、重复节点
2. **优化分布式子调用**：按域分组而非按 gap 数量
3. **增加语义相似度去重**：减少重复节点
4. **增加早期停止条件**：达到最小目标节点数且覆盖度 >80% 时停止

---

## 四、交付物清单

### P3-5 交付物
| 文件 | 说明 |
| --- | --- |
| plugin/SKILL.md | 完善的插件核心文档（含端到端 7 步流程） |
| plugin/workflows/*.md | 6 个工作流文档 |
| plugin/prompts/*.md | 2 个提示词模板 |
| plugin/examples/lidar-profile-example.ts | 激光雷达 Profile 示例 |

### P3-6 修复交付物
| 文件 | 说明 |
| --- | --- |
| server/profile/profile-designer.ts | 修复 JSON 提取、增加重试机制、优化提示词 |
| scripts/test-profile-design.mjs | Node.js 测试脚本（避免 PowerShell 编码问题） |

### 提交记录
| 提交 | 说明 |
| --- | --- |
| d74b5f4 | P3-5: 工作流文档与插件完善 |
| 5da0f81 | fix(P3-6): 修复 Profile 设计器 JSON 提取问题 |
| fdf0e3d | fix(P3-6): 优化 Profile 设计器提示词，明确要求直接输出 JSON |

---

## 五、验证结论

### 已完成
- P3-5 工作流文档与插件完善全部完成
- P3-6 验证发现并修复了多个问题（编码问题、JSON 提取、提示词优化）
- 代码层面的问题已修复，API 路由正确注册
- FMCW 基线零退化

### 待完成
- Profile 设计器端到端功能验证（受 LLM 模型行为影响）
- 知识生成器端到端功能验证
- 建议换模型或使用 chat/completions API 解决输出格式问题

### 关键经验
1. **PowerShell 中文编码问题**：测试 API 时使用 Node.js 脚本，避免 PowerShell 的编码问题
2. **LLM 输出格式控制**：不同模型的行为差异很大，需要根据模型特点调整提示词或换模型
3. **extractJSON 鲁棒性**：增加多种提取策略可以提高成功率，但无法解决模型完全不输出 JSON 的问题
4. **FMCW 零退化**：每步修改后验证 tsc 和自动化测试，确保不影响现有功能

---

**报告完成时间**：2026-09-04
**报告作者**：knowmap-agent
