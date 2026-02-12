# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tyranids 是一个基于虫群智能的编程 Agent 系统,灵感来自战锤40k的泰伦虫族。

**核心特性**:
- 🐝 去中心化虫群协作 (无 Lead Agent)
- 🧬 基因吞噬与自我进化
- 🦠 6种预定义兵种 (Explorer, Refiner, Validator, Carnifex, Lictor, Hive Tyrant)
- 📊 详细度量和可视化
- 💰 成本优化 (目标 <$0.20 per task)

## 技术栈

- **语言**: TypeScript 5.9.2
- **运行时**: Node.js 20+
- **LLM 框架**: Pi (@mariozechner/pi-ai)
- **支持的提供商**: Anthropic, OpenAI, Google, Minimax
- **构建工具**: TypeScript Compiler, npm workspaces

## 项目结构

```
tyranids/
├── packages/
│   └── swarm-core/              # 核心虫群引擎
│       ├── src/
│       │   ├── pheromone-pool.ts      # 信息素池
│       │   ├── swarm-agent-pi.ts      # 虫群个体 (Pi版本)
│       │   ├── orchestrator-pi.ts     # 虫群编排器 (Pi版本)
│       │   ├── observer.ts            # 观测和度量系统
│       │   ├── evaluator.ts           # 质量评估器
│       │   └── bioengine/             # 泰伦生物引擎
│       │       ├── types.ts           # 类型定义
│       │       ├── bioforms.ts        # 预定义兵种
│       │       └── tyranid-bioengine.ts  # 进化引擎
│       └── package.json
├── examples/
│   └── add-priority-feature/    # 示例: 为 TODO 添加优先级
│       ├── todo.ts              # 原始代码
│       ├── run-swarm.ts         # Anthropic 版本
│       ├── run-swarm-minimax.ts # Minimax 版本
│       └── demo-bioengine.ts    # 生物引擎演示
└── docs/
    ├── architecture.md          # 系统架构
    ├── pi-framework-api.md      # Pi 框架 API
    ├── bioengine.md             # 生物引擎文档
    ├── quick-start.md           # 快速上手
    └── minimax-setup.md         # Minimax 配置指南
```

## 常用命令

### 构建

```bash
# 根目录 - 构建所有包
npm run build

# swarm-core - 单独构建
cd packages/swarm-core
npm run build

# 清理构建产物
npm run clean
```

### 测试

```bash
# 运行单元测试
cd packages/swarm-core
npm test

# 运行虫群示例 (Anthropic)
cd examples/add-priority-feature
export ANTHROPIC_API_KEY="sk-ant-..."
npm run test-swarm

# 运行虫群示例 (Minimax)
cd examples/add-priority-feature
export MINIMAX_API_KEY="your-key"
export MINIMAX_GROUP_ID="your-group-id"
npm run test-swarm-minimax

# 演示生物引擎
cd examples/add-priority-feature
npm run demo-bioengine
```

## 核心架构

### 1. 信息素池 (PheromonePool)

**作用**: 虫群的共享知识库,类似蚁群的信息素轨迹

**关键方法**:
- `deposit(pheromone)` - 存储信息素
- `read(filter)` - 读取信息素
- `getTop(n)` - 获取质量最高的 n 个方案
- `calculateConvergence()` - 计算收敛度

**信息素强化**: 当多个 Agent 支持同一方案时,质量 +0.1 (最高 1.0)

### 2. 虫群个体 (SwarmAgentPi)

**行为模式**:
- 60% 跟随最强信息素 (exploitation)
- 25% 探索相似方案 (local search)
- 15% 完全随机探索 (exploration)

**关键方法**:
- `execute(maxIterations)` - 主循环
- `decideAction()` - 概率决策
- `performAction()` - 执行动作 (调用 LLM)
- `stop()` - 停止执行

**状态**: EXPLORING, REFINING, IDLE

### 3. 虫群编排器 (SwarmOrchestratorPi)

**职责**: 统筹虫群执行,但不控制个体行为

**关键方法**:
- `execute()` - 执行虫群
- `spawnAgents()` - 派生 agents
- `monitorConvergence()` - 监控收敛
- `stopAllAgents()` - 停止所有 agents

**收敛条件**: 80% agents 聚集在同一方案

### 4. 观测器 (SwarmObserver)

**职责**: 收集度量数据,生成报告

**关键方法**:
- `recordAgentAction()` - 记录 agent 行为
- `recordPheromoneSnapshot()` - 记录信息素快照
- `recordLLMCall()` - 记录 LLM 调用
- `generateReport()` - 生成报告
- `visualizePheromoneEvolution()` - ASCII 可视化

### 5. 泰伦生物引擎 (TyranidBioEngine)

**职责**: 基因吞噬与进化

**关键方法**:
- `recordExecution()` - 记录执行到基因库
- `triggerEvolution()` - 触发遗传算法优化
- `loadEvolvedConfig()` - 加载进化后的配置
- `analyzeEvolutionOpportunities()` - 分析进化机会

**进化机制**: 每 10 次执行自动触发,使用遗传算法 (选择、交叉、变异)

## 开发指南

### 添加新的预定义兵种

编辑 `packages/swarm-core/src/bioengine/bioforms.ts`:

```typescript
export const BIOFORMS: { [key: string]: Bioform } = {
  // ... 现有兵种 ...

  newBioform: {
    name: 'NewBioform',
    role: '新兵种 - 描述',
    traits: {
      explorationRate: 0.25,
      qualityThreshold: 0.80,
      agentCount: 5,
      speed: 'normal',
      cost: 'medium',
      maxIterations: 20,
    },
    适用场景: ['场景1', '场景2'],
  },
};
```

### 修改虫群行为概率

编辑 `packages/swarm-core/src/swarm-agent-pi.ts`:

```typescript
private decideAction(pheromones: Pheromone[]): Action {
  const random = Math.random();

  // 修改这些概率值
  if (random < 0.60 && pheromones.length > 0) {
    // Exploitation
    return { type: 'REFINE', target: pheromones[0] };
  } else if (random < 0.85 && pheromones.length > 3) {
    // Local search
    return { type: 'REFINE', target: pheromones[Math.floor(Math.random() * 3) + 1] };
  } else {
    // Exploration
    return { type: 'EXPLORE' };
  }
}
```

### 调整质量评估权重

编辑 `packages/swarm-core/src/evaluator.ts`:

```typescript
async evaluateCodeFragment(fragment: CodeFragment): Promise<number> {
  const compiles = await this.checkCompilation(fragment);
  const complete = this.checkCompleteness(fragment);
  const simple = this.checkSimplicity(fragment);

  // 修改这些权重
  return (
    0.4 * (compiles ? 1 : 0) +
    0.3 * complete +
    0.3 * simple
  );
}
```

### 添加新的 LLM 提供商

Pi 框架原生支持多个提供商,只需在创建 Orchestrator 时指定:

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'your-provider', // anthropic, openai, google, minimax 等
});
```

确保设置相应的环境变量。

## 重要概念

### 去中心化 vs 中心化

**Tyranids (去中心化)**:
- 无 Lead Agent
- Agents 通过信息素池间接通信
- 收敛自然涌现

**Claude Code Agent Teams (中心化)**:
- 有 Lead Agent 统筹
- Agents 点对点消息通信
- Lead 审批计划

### 信息素强化

当多个 Agent 发现并支持同一方案时:
- 该方案的信息素质量 +0.1
- 吸引更多 Agent 跟随
- 形成正反馈循环

### 收敛检测

```typescript
convergence = topPheromone.depositors.length / totalAgents
```

当 `convergence >= 0.8` 时,系统认为已收敛。

### 基因吞噬

每次执行后自动记录到 `~/.tyranids/gene-pool/execution-history.jsonl`:
- 任务类型
- 使用的配置
- 执行结果 (质量、速度、成本)
- 综合评分

每 10 次执行触发遗传算法,优化配置参数。

## 常见陷阱

### 1. 不要手动干预 Agent 行为

❌ **错误**:
```typescript
if (agent.state === 'EXPLORING') {
  agent.state = 'REFINING'; // 手动改变状态
}
```

✅ **正确**:
让 Agent 自主决策,通过调整概率和配置影响行为。

### 2. 不要破坏信息素池的共享性

❌ **错误**:
```typescript
const pool1 = new PheromonePool();
const pool2 = new PheromonePool();
// Agents 使用不同的池
```

✅ **正确**:
所有 Agents 必须共享同一个 PheromonePool 实例。

### 3. 不要忽略收敛检测

❌ **错误**:
```typescript
// 强制运行所有迭代
for (let i = 0; i < maxIterations; i++) {
  await agent.execute();
}
```

✅ **正确**:
使用 Orchestrator 的 `monitorConvergence()`,检测到收敛立即停止。

## 调试技巧

### 查看详细日志

所有关键操作都有 console.log 输出:
- Agent 生成
- 行为决策
- 信息素存储
- 收敛监控

### 导出度量数据

```typescript
const metrics = orchestrator.observer.exportJSON();
await writeFile('metrics.json', metrics);
```

分析 JSON 文件查看详细数据。

### 可视化信息素演化

```typescript
orchestrator.observer.visualizePheromoneEvolution();
```

查看 ASCII 图表了解收敛过程。

## 性能优化

### 减少成本

```typescript
const config = {
  agentCount: 3,              // 减少 agents
  maxIterations: 15,          // 减少迭代
  modelPreference: 'haiku-only',  // 使用小模型
};
```

### 加快收敛

```typescript
const config = {
  convergenceThreshold: 0.7,  // 降低收敛阈值
  explorationRate: 0.10,      // 降低探索率,更多利用
};
```

### 提高质量

```typescript
const config = {
  agentCount: 10,             // 增加 agents
  maxIterations: 30,          // 增加迭代
  modelPreference: 'sonnet-preferred',  // 使用大模型
};
```

## 参考文档

- [快速上手](./docs/quick-start.md) - 5 分钟入门
- [Minimax 配置](./docs/minimax-setup.md) - 使用 Minimax 模型
- [系统架构](./docs/architecture.md) - 深入理解设计
- [生物引擎](./docs/bioengine.md) - 进化机制详解
- [Pi 框架 API](./docs/pi-framework-api.md) - LLM 接口文档
