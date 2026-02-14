# Minimax 快速开始指南

## 🚀 5 分钟快速体验 Tyranids 虫群系统

### 前置要求

```bash
# 1. 安装依赖
npm install

# 2. 设置 Minimax API Key
export MINIMAX_API_KEY="your-minimax-api-key"
```

### 运行示例

```bash
# 构建项目
npm run build

# 运行 Minimax 虫群测试
cd examples/add-priority-feature
npm run test-swarm-minimax
```

### 预期结果

```
🐝 Tyranids 虫群系统 - Minimax 版本

配置:
- LLM 提供商: Minimax
- Agent 数量: 5
- 最大迭代: 20
- 收敛阈值: 80%

🐝 启动虫群...
📋 任务: 为 Todo 接口添加优先级(priority)功能

🧬 派生 5 个虫子...
  [agent-0] 已生成
  [agent-1] 已生成
  ...

[agent-0] Iteration 0: EXPLORE (quality: 1.00)
[agent-1] Iteration 0: EXPLORE (quality: 1.00)
...

✅ 虫群执行完成
📊 发现 12 个方案
🏆 Top-3 质量: [1.00, 1.00, 1.00]

💾 保存结果...
✅ 方案 1 已保存: generated-solution-minimax-1.ts
✅ 方案 2 已保存: generated-solution-minimax-2.ts
✅ 方案 3 已保存: generated-solution-minimax-3.ts

📈 执行总结:
- 总耗时: 100.17s
- 发现方案: 12 个
- Top-3 质量: [1.00, 1.00, 1.00]
- 估算成本: ¥0.05
- 收敛轮次: -1
```

### 查看生成的代码

```bash
# 查看 Top-3 方案
cat examples/add-priority-feature/generated/generated-solution-minimax-1.ts
cat examples/add-priority-feature/generated/generated-solution-minimax-2.ts
cat examples/add-priority-feature/generated/generated-solution-minimax-3.ts

# 查看详细度量数据
cat examples/add-priority-feature/generated/swarm-metrics-minimax.json
```

## 📊 理解输出

### 方案质量

- **1.00**: 完美方案（编译通过 + 功能完整 + 代码简洁）
- **0.70-0.99**: 良好方案（可能缺少某些特性）
- **0.30-0.69**: 有问题方案（编译失败或功能不完整）

### Agent 行为

- **EXPLORE**: 探索新方案（创新）
- **REFINE**: 改进现有方案（优化）

### 收敛度

- **< 50%**: 高多样性，agents 探索不同路径
- **50-80%**: 逐步收敛
- **> 80%**: 已收敛，大部分 agents 聚集在同一方案

## 🎨 自定义配置

编辑 `run-swarm-minimax.ts`:

```typescript
const config: SwarmConfig = {
  agentCount: 5,              // 虫群规模 (3-10 推荐)
  maxIterations: 20,          // 最大轮数
  convergenceThreshold: 0.8,  // 收敛阈值 (0.6-0.9)
  explorationRate: 0.15,      // 探索率 (0.1-0.3)
  modelPreference: 'haiku-only',  // 模型偏好
};
```

## 💡 提示

### 高质量 vs 高多样性

**追求单一最优方案**:
```typescript
agentCount: 3,
convergenceThreshold: 0.9,
explorationRate: 0.10,
```

**追求多样化方案**:
```typescript
agentCount: 7,
convergenceThreshold: 0.6,
explorationRate: 0.25,
```

### 成本优化

**低成本配置**:
```typescript
agentCount: 3,
maxIterations: 10,
modelPreference: 'haiku-only',
```

**高质量配置**:
```typescript
agentCount: 7,
maxIterations: 30,
modelPreference: 'sonnet-preferred',  // 使用更强模型
```

## 🐛 故障排查

### 问题: API Key 无效

**错误**: `❌ 错误: 未设置 MINIMAX_API_KEY 环境变量`

**解决**:
```bash
export MINIMAX_API_KEY="your-actual-api-key"
echo $MINIMAX_API_KEY  # 验证已设置
```

### 问题: 生成的代码为空

**症状**: `generated-solution-minimax-*.ts` 文件大小为 0

**原因**: API 认证失败或网络问题

**解决**:
1. 检查 API key 是否正确
2. 检查网络连接
3. 查看完整日志: `tail -100 /tmp/minimax-test.log`

### 问题: 质量评分低

**症状**: 所有方案质量 < 0.5

**可能原因**:
- 任务描述不清晰
- 模型不理解要求
- 评估标准过于严格

**解决**:
1. 优化任务描述（更具体、更清晰）
2. 调整评估权重
3. 尝试不同的模型

## 📚 下一步

- 阅读完整文档: `README.md`
- 查看详细报告: `MINIMAX_SUCCESS_REPORT.md`
- 尝试其他 provider: `run-swarm.ts` (Anthropic)
- 探索进化系统: `demo-bioengine.ts`

## 🤝 获取帮助

- GitHub Issues: https://github.com/your-org/tyranids/issues
- 文档: `docs/`
- 示例: `examples/`

---

**享受虫群智能的力量！** 🐝✨
