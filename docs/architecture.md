# Tyranids 虫群系统架构

## 概述

Tyranids 是一个基于虫群智能的编程 Agent 系统,灵感源自战锤40k的泰伦虫族(Tyranids)和蚁群优化算法。

## 核心理念

### 1. 去中心化协作
- **无中心调度器**: 没有 Lead Agent,所有虫子平等
- **信息素通信**: 通过共享信息素池间接通信
- **自组织行为**: 通过简单规则产生复杂的涌现行为

### 2. 概率决策
- **60% 利用 (Exploitation)**: 跟随质量最高的信息素
- **25% 局部搜索 (Local Search)**: 探索次优方案
- **15% 全局探索 (Exploration)**: 随机生成新方案

### 3. 自动收敛
- **收敛度检测**: 计算支持顶部方案的 agents 比例
- **收敛阈值**: 默认 80% agents 聚集时停止
- **早期停止**: 发现高质量方案(>0.95)时提前终止

## 技术架构

### 核心组件

```
SwarmOrchestrator (虫群编排器)
    ↓
├── PheromonePool (信息素池 - 共享状态)
├── SwarmAgent × N (并行代理)
├── Evaluator (质量评估)
└── SwarmObserver (观测和度量)
```

### 包结构

```
@tyranids/swarm-core          # 核心引擎
├── PheromonePool             # 信息素存储
├── SwarmAgent / SwarmAgentPi # 虫群个体 (原生/Pi版本)
├── SwarmOrchestrator / SwarmOrchestratorPi # 编排器
├── Evaluator                 # 代码质量评估
└── SwarmObserver             # 度量和观测

@tyranids/swarm-skills        # Claude Code 集成
├── SwarmRuntime / SwarmRuntimePi # 运行时环境
└── SwarmSkillHandler         # Skills 处理器
```

## 实现版本

Tyranids 提供两套实现:

### 1. 原生版本 (基于 Anthropic SDK)

**优点:**
- 直接集成 Anthropic API,简单直接
- 完全控制 LLM 调用细节
- 已完成并经过测试

**使用:**
```typescript
import { SwarmOrchestrator } from '@tyranids/swarm-core';
import Anthropic from '@anthropic-ai/sdk';

const orchestrator = new SwarmOrchestrator({
  config,
  llm: new Anthropic(),
  task
});
```

**文件:**
- `swarm-agent.ts`
- `orchestrator.ts`
- `swarm-runtime.ts`

### 2. Pi 版本 (基于 @mariozechner/pi-ai)

**优点:**
- 统一的 LLM 接口,支持 15+ 提供商
- 类型安全的模型选择
- 内置成本追踪
- 可切换 provider (Anthropic/OpenAI/Google等)

**使用:**
```typescript
import { SwarmOrchestratorPi } from '@tyranids/swarm-core';

const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic'  // or 'openai', 'google'
});
```

**文件:**
- `swarm-agent-pi.ts`
- `orchestrator-pi.ts`
- `swarm-runtime-pi.ts`

**相关文档:**
- [Pi 框架 API 参考](./pi-framework-api.md)

## 核心算法

### 信息素机制

```typescript
// 存储信息素
await pheromonePool.deposit({
  id: 'agent-0-1',
  codeFragment: { filePath, content, intent },
  quality: 0.85,  // 0-1 评分
  depositors: ['agent-0'],
  timestamp: Date.now()
});

// 读取信息素 (按质量降序)
const pheromones = await pheromonePool.read();

// 信息素强化: 相同方案被多个 agents 支持时质量增加
// quality += 0.1 (最大 1.0)
```

### 行为决策

```typescript
private decideAction(pheromones: Pheromone[]): Action {
  const random = Math.random();

  if (pheromones.length === 0) {
    return { type: 'EXPLORE' };  // 无信息素,必须探索
  }

  if (random < 0.6) {
    return { type: 'REFINE', target: pheromones[0] };  // 跟随最优
  }

  if (random < 0.85 && pheromones.length > 1) {
    const idx = Math.min(Math.floor(Math.random() * 3) + 1, pheromones.length - 1);
    return { type: 'REFINE', target: pheromones[idx] };  // 局部搜索
  }

  return { type: 'EXPLORE' };  // 全局探索
}
```

### 质量评估

```typescript
// 多维度评估
const quality = 0.4 * compiles +    // 40% 编译成功
                0.3 * complete +    // 30% 功能完整
                0.3 * simple;       // 30% 代码简洁

// 编译检查
const compiles = await execAsync(`npx tsc --noEmit ${tmpFile}`);

// 完整性检查
const complete = content.length > 50 &&
                 /interface|type/.test(content) &&
                 /priority/.test(content);

// 简洁性检查
const simple = lines.length < 500 && complexity < 20;
```

### 收敛检测

```typescript
// 计算收敛度
const convergence = topPheromone.depositors.length / totalAgents;

// 收敛条件
if (convergence >= 0.8) {
  // 80% agents 支持同一方案
  stopAllAgents();
}

// 早期停止
if (topQuality > 0.95 && convergence > 0.6) {
  // 高质量 + 多数支持
  stopAllAgents();
}
```

## 执行流程

### 1. 初始化

```
SwarmOrchestrator.execute()
├─> 启动 SwarmObserver
├─> 生成 N 个 SwarmAgent
└─> 启动收敛监控线程
```

### 2. Agent 并行执行

```
Promise.all(agents.map(agent => agent.execute()))

每个 Agent:
  for i in 0..maxIterations:
    1. 读取信息素池
    2. 概率决策 (EXPLORE/REFINE)
    3. 调用 LLM 生成代码
    4. 评估质量 (compilation + completeness + simplicity)
    5. 存储信息素
    6. 检查是否应停止
```

### 3. 收敛监控

```
while iteration < maxIterations:
  sleep(5秒)
  计算收敛度
  记录信息素快照

  if 收敛度 >= 阈值:
    停止所有 agents
    break

  if 高质量 && 多数支持:
    提前停止
    break
```

### 4. 结果提取

```
SwarmOrchestrator.execute() 返回:
├─> Top-3 最佳方案
├─> 详细执行报告
└─> 可视化图表 (ASCII)
```

## 观测和度量

### 收集的指标

```typescript
interface SwarmMetrics {
  // 时间统计
  startTime, endTime, duration

  // Agent 行为
  agentActions: {
    [agentId]: { explores, refines, validates, idles }
  }

  // 信息素演化快照
  pheromoneEvolution: [
    { iteration, topQuality, avgQuality, diversity, convergence }
  ]

  // LLM 成本
  llmCalls: {
    total, byModel, inputTokens, outputTokens, estimatedCost
  }

  // 收敛分析
  convergenceDetected, convergenceIteration, finalConvergenceRatio
}
```

### 报告示例

```
# Tyranids 虫群执行报告

## 时间统计
- 总耗时: 45.23s
- 收敛轮次: 8

## Agent 行为分析
agent-0: 3次探索, 5次精炼, 探索率: 37.5%
agent-1: 2次探索, 6次精炼, 探索率: 25.0%
...

## 信息素演化
| 迭代 | 最高质量 | 收敛度 |
|------|----------|--------|
| 0    | 0.45     | 0.20   |
| 5    | 0.87     | 0.60   |
| 8    | 0.96     | 0.82   | 🎯

## 成本分析
- LLM 调用总数: 40
- Haiku 调用: 38
- Sonnet 调用: 2
- **估算成本: $0.08**

## 关键洞察
1. ⚡ 快速收敛: 虫群在前 10 轮内即找到优质方案
2. 💰 成本优秀: 每个 agent 平均成本 <$0.02
3. 🌈 方案多样性高: 虫群探索了多种不同实现路径
```

## 与传统 Agent Teams 的对比

| 维度 | Claude Code Agent Teams | Tyranids 虫群 |
|------|-------------------------|---------------|
| 架构 | 中心化 (Lead + Teammates) | ✅ 去中心化 |
| 任务分配 | FIFO 或 Lead 分配 | ✅ 信息素引导 |
| 通信方式 | 点对点消息 | ✅ 信息素共享 |
| 决策机制 | Lead 审批 | ✅ 涌现收敛 |
| 成本 | ~7x 单会话 | ✅ 目标 <3x |
| 容错 | 弱 (Lead 是单点) | ✅ 强 (无中心) |
| 多样性 | 低 | ✅ 高 (并行探索) |

## 技术栈

- **语言**: TypeScript 5.9.2
- **运行时**: Node.js 20+
- **LLM 框架**:
  - 原生版本: `@anthropic-ai/sdk`
  - Pi 版本: `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`
- **构建工具**: TypeScript Compiler
- **包管理**: npm workspaces

## 配置参数

```typescript
interface SwarmConfig {
  agentCount: number;              // 虫群规模 (5-20)
  maxIterations: number;           // 最大迭代次数 (10-30)
  convergenceThreshold: number;    // 收敛阈值 (0.7-0.9)
  explorationRate?: number;        // 探索率 (0.1-0.3)
  modelPreference?: 'haiku-only' | 'mixed' | 'sonnet-preferred';
}
```

**推荐配置:**
- **快速任务**: 3 agents, 10 iterations, haiku-only
- **标准任务**: 5 agents, 20 iterations, haiku-only
- **复杂任务**: 10 agents, 30 iterations, mixed

## 成本优化策略

1. **模型选择**:
   - 探索阶段: Claude Haiku ($0.25/$1.25 per MTok)
   - 精炼阶段: 可选 Claude Sonnet ($3/$15 per MTok)

2. **Prompt 优化**:
   - 简洁的任务描述 (~200 tokens)
   - 只传递必要的代码上下文

3. **早期停止**:
   - 高质量方案(>0.95)时提前终止
   - 避免无效迭代

4. **目标成本**: <$0.15 per task (vs $0.40+ for Agent Teams)

## 下一步开发

### Phase 7: 泰伦生物引擎
- 基因吞噬: 从成功执行中提取"基因"
- 兵种进化: 动态生成专门化 agents
- 环境适应: 分析代码库生成适应性配置

### Phase 8: 测试场景
- TODO 应用添加优先级功能
- 验证多方案探索
- 验证收敛机制

### Phase 9: MVP 验证
- 功能完整性测试
- 性能和成本测试
- 与其他系统对比

## 参考资料

- [BLUEPRINT.md](../BLUEPRINT.md) - 详细技术蓝图
- [Pi 框架 API 参考](./pi-framework-api.md) - Pi 框架集成文档
- [GitHub - badlogic/pi-mono](https://github.com/badlogic/pi-mono) - Pi 框架源码
