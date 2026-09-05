# Step 1：设计并验证 Profile

执行者：宿主 LLM。输入：主题、范围、可选资料。输出：TaskProfile JSON。读取 [Profile 提示词](../prompts/profile-design-prompt.md) 和 ../contracts/task-profile.ts。

1. 需要参考时执行：
```sh
node scripts/knowmap.mjs profile-example --output work/lidar-example.json
```
2. 宿主根据主题直接编辑 work/profile-draft.json。也可以创建 work/design-request.json：
```json
{"topic":"激光雷达技术路线","taskDescription":"面向工程学习，比较测距原理、光源、接收与点云处理"}
```
再调用现有五阶段 ProfileDesigner（需要已配置提供商）：
```sh
node scripts/knowmap.mjs design --input work/design-request.json --output work/profile-draft.json
```
3. 校验并输出规范化 Profile：
```sh
node scripts/knowmap.mjs validate-profile --input work/profile-draft.json --output work/profile.json
```

验证：命令退出0；域 ID 唯一，根不与域重复，域分支引用存在，validation 数量等于实际数量。域数不强制3–8。初始 nodeCount 是目标范围。当前实现只支持基础类型和栏目，不能凭 Profile 新增 UI 类型。

修复：根据错误字段修改草稿，再写新输出文件。不要复制空数组作为有效 Profile；不要从 profile.id 推测 rootNode.id（激光雷达示例分别是 lidar-tech-route 和 lidar）。宿主设计无需额外 Key；design 命令使用运行时配置或环境变量。

API 替代入口为 POST /api/profile/design，body 与 design-request 相同，返回 {profile,iterations,validationIssues,warnings}。无论从哪个入口得到 Profile，都跑同一校验。
