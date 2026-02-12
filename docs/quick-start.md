# 快速上手指南

本指南将帮助你在 5 分钟内运行第一个虫群测试。

## 前置要求

- Node.js 20+
- API Key (Anthropic/OpenAI/Google/Minimax 等)

## 步骤 1: 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/tyranids.git
cd tyranids

# 安装依赖
npm install

# 构建项目
npm run build
```

## 步骤 2: 配置 API Key

### 使用 Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 使用 Minimax

```bash
export MINIMAX_API_KEY="your-minimax-key"
export MINIMAX_GROUP_ID="your-group-id"
```

### 使用 OpenAI

```bash
export OPENAI_API_KEY="sk-..."
```

## 步骤 3: 运行示例

```bash
cd examples/add-priority-feature

# 方式1: 运行完整虫群测试
npm run test-swarm

# 方式2: 演示生物引擎功能
npm run demo-bioengine
```

## 步骤 4: 查看结果

虫群执行完成后,会在 `generated/` 目录生成:

```
generated/
├── generated-solution-1.ts    # Top-1 方案
├── generated-solution-2.ts    # Top-2 方案
├── generated-solution-3.ts    # Top-3 方案
└── swarm-metrics.json         # 执行度量数据
```

## 预期输出

```
🐝 启动虫群...
📋 任务: 为 Todo 接口添加优先级功能
📄 文件: todo.ts
👥 规模: 5 agents

🧬 派生 5 个虫子...
  [agent-0] 已生成
  [agent-1] 已生成
  [agent-2] 已生成
  [agent-3] 已生成
  [agent-4] 已生成

[监控 0] 收敛度: 20% | 最高质量: 0.65
[监控 1] 收敛度: 45% | 最高质量: 0.78
[监控 2] 收敛度: 65% | 最高质量: 0.85
[监控 3] 收敛度: 82% | 最高质量: 0.92

🎯 检测到收敛 (82% >= 80%)
📍 第 3 轮达到收敛

✅ 虫群执行完成
📊 发现 8 个方案
🏆 Top-3 质量: [0.92, 0.87, 0.85]

💾 保存结果...
✅ 方案 1 已保存: generated-solution-1.ts
   质量: 0.92
   支持: 4 agents

📊 度量数据已保存: swarm-metrics.json

📈 执行总结:
- 总耗时: 45.23s
- 发现方案: 8 个
- Top-3 质量: [0.92, 0.87, 0.85]
- LLM 调用: 28 次
- 估算成本: $0.0456
- 收敛轮次: 3
```

## 自定义配置

创建你自己的测试脚本:

```typescript
import { SwarmOrchestratorPi } from '@tyranids/swarm-core';
import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  // 1. 读取原始代码
  const baseCode = await readFile('./your-file.ts', 'utf-8');

  // 2. 定义任务
  const task = {
    description: '你的任务描述',
    filePath: './your-file.ts',
    baseCode,
    type: 'add-feature' as const,
  };

  // 3. 配置虫群
  const config = {
    agentCount: 5,
    maxIterations: 20,
    convergenceThreshold: 0.8,
    explorationRate: 0.15,
    modelPreference: 'haiku-only' as const,
  };

  // 4. 执行
  const orchestrator = new SwarmOrchestratorPi({
    config,
    task,
    provider: 'anthropic', // 或 'openai', 'google'
  });

  const solutions = await orchestrator.execute();

  // 5. 保存结果
  for (let i = 0; i < solutions.length; i++) {
    await writeFile(
      `solution-${i + 1}.ts`,
      solutions[i].codeFragment.content
    );
  }
}

main().catch(console.error);
```

## 使用不同的 LLM 提供商

### Anthropic (Claude)

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic',
});
```

### Minimax

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'minimax', // Pi 框架支持
});
```

### OpenAI

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'openai',
});
```

## 查看执行度量

```typescript
// 获取观测器
const metrics = orchestrator.observer.getMetrics();

console.log('执行时间:', metrics.duration / 1000, 's');
console.log('LLM 调用次数:', metrics.llmCalls.total);
console.log('估算成本: $', metrics.llmCalls.estimatedCost);
console.log('收敛轮次:', metrics.convergenceIteration);

// 生成报告
const report = orchestrator.observer.generateReport();
console.log(report);

// 可视化
orchestrator.observer.visualizePheromoneEvolution();
```

## 使用生物引擎

### 查看预定义兵种

```typescript
import { listBioforms, recommendBioform } from '@tyranids/swarm-core';

// 列出所有兵种
const bioforms = listBioforms();
bioforms.forEach(b => {
  console.log(`${b.name}: 探索率=${b.traits.explorationRate}`);
});

// 根据任务类型推荐
const bioform = recommendBioform('add-feature');
console.log('推荐兵种:', bioform.name);
```

### 查看进化统计

```typescript
import { TyranidBioEngine } from '@tyranids/swarm-core';

const bioEngine = new TyranidBioEngine();
await bioEngine.initialize();

// 查看统计
const stats = await bioEngine.getStatistics();
console.log('总执行次数:', stats.totalExecutions);
console.log('平均评分:', stats.avgScore);
console.log('最高评分:', stats.bestScore);

// 分析进化机会
const analysis = await bioEngine.analyzeEvolutionOpportunities();
console.log(analysis);
```

### 使用进化后的配置

```typescript
// 加载进化后的配置
const evolvedConfig = await SwarmOrchestratorPi.loadEvolvedConfig('add-feature');

if (evolvedConfig) {
  console.log('使用进化后的配置:', evolvedConfig);
  // 使用进化后的配置创建编排器
  const orchestrator = new SwarmOrchestratorPi({
    config: evolvedConfig,
    task,
    provider: 'anthropic',
  });
}
```

## 常见问题

### Q: 如何减少成本?

A: 使用 `modelPreference: 'haiku-only'` 配置,或减少 `agentCount` 和 `maxIterations`。

```typescript
const config = {
  agentCount: 3,        // 减少到 3 个 agents
  maxIterations: 10,    // 减少到 10 轮
  modelPreference: 'haiku-only',
};
```

### Q: 如何加快执行速度?

A: 增加 `convergenceThreshold` 使其更快收敛:

```typescript
const config = {
  convergenceThreshold: 0.7,  // 从 0.8 降低到 0.7
};
```

### Q: 如何获得更多样化的方案?

A: 增加 `explorationRate`:

```typescript
const config = {
  explorationRate: 0.30,  // 从 0.15 增加到 0.30
};
```

### Q: 如何禁用自动进化?

A: 设置 `enableEvolution: false`:

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic',
  enableEvolution: false,  // 禁用自动进化
});
```

### Q: 如何查看详细日志?

A: 所有日志会自动输出到控制台。观测器会实时显示:
- Agent 生成过程
- 收敛监控
- 信息素演化
- 最终报告

## 下一步

- 查看 [系统架构](./architecture.md) 了解工作原理
- 查看 [泰伦生物引擎](./bioengine.md) 了解进化机制
- 查看 [Pi 框架 API](./pi-framework-api.md) 了解如何使用不同的 LLM

## 获取帮助

- 查看 [docs/](../docs/) 目录下的文档
- 查看 [examples/](../examples/) 目录下的示例
- 提交 [Issue](https://github.com/yourusername/tyranids/issues)
