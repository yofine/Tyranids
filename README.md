# 🦎 Tyranids - 虫群智能编程 Agent 系统

> 灵感来自战锤40k泰伦虫族 - 基于虫群智能的 AI 编程 Agent 系统，能够自我进化和适应

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#chinese)

---

## <a name="chinese"></a>🧬 核心理念

Tyranids 实现了一种**虫群智能**的代码生成方法，灵感来自战锤40k的泰伦虫族：

- **🧬 基因吞噬 (Gene Devouring)**: 从每次成功执行中吸收模式
- **🧠 主宰意志 (Hive Mind)**: 通过信息素池共享知识
- **🦠 兵种进化 (Bioform Evolution)**: 针对不同任务的专门化 Agent "兵种"
- **🌍 行星适应 (Planetary Adaptation)**: 快速分析并适应新代码库
- **♾️ 无限增殖**: 根据任务复杂度动态调整虫群规模

## ✨ 特性

### 🐝 虫群协作

- **去中心化架构**: 无 Lead Agent，所有 Agent 平等
- **信息素通信**: 通过共享信息素池间接协作
- **涌现收敛**: 最佳方案自然吸引更多 Agent
- **并行探索**: 同时探索多种不同实现路径

### 🧬 自我进化

- **6种预定义兵种**: Explorer, Refiner, Validator, Carnifex, Lictor, Hive Tyrant
- **遗传算法优化**: 自动优化虫群配置参数
- **基因库积累**: 跨项目共享成功经验
- **零配置进化**: 每10次执行自动触发进化

### 📊 可观测性

- **详细度量**: 执行时间、成本、收敛度、质量分布
- **可视化**: ASCII 图表展示信息素演化
- **完整报告**: Agent 行为分析、关键洞察
- **实时监控**: 收敛过程实时追踪

### 💰 成本优化

- **目标成本**: <$0.20 per task (vs Claude Code Agent Teams 的 7x 单会话)
- **分层模型**: 探索用 Haiku, 精炼用 Sonnet
- **规则驱动决策**: 行为选择不调用 LLM
- **早期停止**: 检测到收敛立即停止

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/tyranids.git
cd tyranids

# 安装依赖
npm install

# 构建所有包
npm run build
```

### 运行示例

```bash
cd examples/add-priority-feature

# 设置 API Key
export ANTHROPIC_API_KEY="your-api-key"

# 运行虫群测试
npm run test-swarm
```

### 基本使用

```typescript
import { SwarmOrchestratorPi, type CodingTask, type SwarmConfig } from '@tyranids/swarm-core';

// 定义任务
const task: CodingTask = {
  description: '为 Todo 接口添加优先级功能',
  filePath: './todo.ts',
  baseCode: '...', // 原始代码
  type: 'add-feature',
};

// 虫群配置
const config: SwarmConfig = {
  agentCount: 5,           // 5 个虫子并行探索
  maxIterations: 20,       // 最多 20 轮迭代
  convergenceThreshold: 0.8,
  explorationRate: 0.15,
  modelPreference: 'haiku-only',
};

// 创建编排器
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic',
});

// 执行虫群
const topSolutions = await orchestrator.execute();

// 获取最佳方案
console.log('Top-3 方案:', topSolutions);
```

## 📦 项目结构

```
tyranids/
├── packages/
│   ├── swarm-core/              # 核心虫群引擎
│   │   ├── src/
│   │   │   ├── pheromone-pool.ts      # 信息素池
│   │   │   ├── swarm-agent-pi.ts      # 虫群个体 (Pi版本)
│   │   │   ├── orchestrator-pi.ts     # 虫群编排器 (Pi版本)
│   │   │   ├── observer.ts            # 观测和度量系统
│   │   │   ├── evaluator.ts           # 质量评估器
│   │   │   └── bioengine/             # 泰伦生物引擎
│   │   │       ├── types.ts           # 类型定义
│   │   │       ├── bioforms.ts        # 预定义兵种
│   │   │       └── tyranid-bioengine.ts  # 进化引擎
│   │   └── package.json
│   └── swarm-skills/            # Claude Code 技能 (未来)
├── examples/
│   └── add-priority-feature/    # 示例: 为 TODO 添加优先级
│       ├── todo.ts              # 原始代码
│       ├── run-swarm.ts         # 虫群测试运行器
│       └── demo-bioengine.ts    # 生物引擎演示
├── docs/
│   ├── architecture.md          # 系统架构文档
│   ├── pi-framework-api.md      # Pi 框架 API 参考
│   ├── bioengine.md             # 泰伦生物引擎文档
│   └── mvp-validation.md        # MVP 验证清单
├── BLUEPRINT.md                 # 详细技术规范
└── README.md                    # 本文件
```

## 🐝 工作原理

### 1. 信息素通信机制

```
Agent 1 探索 → 存储信息素 (质量: 0.85)
                     ↓
              [信息素池]
                ↓    ↓    ↓
Agent 2 读取 ← Agent 3 读取 ← Agent 4 读取
    ↓              ↓              ↓
跟随强化      探索相似      随机探索
```

**概率决策**:
- 60% 跟随最强信息素 (exploitation)
- 25% 探索相似方案 (local search)
- 15% 完全随机探索 (exploration)

### 2. 涌现收敛

```
迭代 0: [A:0.5] [B:0.6] [C:0.4] [D:0.7] [E:0.5]  收敛度: 20%
迭代 3: [B:0.8] [B:0.8] [D:0.9] [D:0.9] [B:0.8]  收敛度: 60%
迭代 5: [D:0.95] [D:0.95] [D:0.96] [D:0.96] [D:0.95]  收敛度: 85% ✅
```

当 80% agents 聚集在同一方案时，系统自动停止。

### 3. 质量评估

```typescript
quality = 0.4 × compiles + 0.3 × complete + 0.3 × simple

compiles  = TypeScript 编译是否通过 (0 或 1)
complete  = 是否包含所有必要修改 (0-1)
simple    = 代码简洁性评分 (0-1)
```

### 4. 基因吞噬与进化

```
执行 1-9 次 → 积累数据到基因库
执行第 10 次 → 🧬 自动触发进化
              ↓
        [遗传算法优化]
         - 选择精英 (top 20%)
         - 交叉生成子代
         - 随机变异 (10%)
         - K近邻预测性能
              ↓
      [进化后的配置]
              ↓
执行第 11 次 → 自动使用新配置 ✨
```

## 🦠 预定义兵种

### Explorer (探索者)
**类比**: 泰伦的 Genestealer
**特点**: 高探索率 (0.40), 追求多样性
**适用**: 新功能开发, 需要创新方案

### Refiner (精炼者)
**类比**: 泰伦的 Tyranid Warrior
**特点**: 低探索率 (0.05), 追求完美
**适用**: 代码重构, 性能优化

### Validator (验证者)
**类比**: 泰伦的 Gargoyle
**特点**: 中等探索率 (0.10), 专注验证
**适用**: Bug修复, 测试验证

### Carnifex (重型突击兵)
**类比**: 泰伦的 Carnifex
**特点**: 15个Agents, 大规模并行
**适用**: 大规模重构, 整个模块重写

### Lictor (刺客)
**类比**: 泰伦的 Lictor
**特点**: 单Agent, 极速执行
**适用**: 简单bug修复, 快速迭代

### Hive Tyrant (主宰暴君)
**类比**: 泰伦的 Hive Tyrant
**特点**: 平衡配置, 通用性强
**适用**: 一般性任务, 未知任务类型

## 📊 与 Claude Code Agent Teams 的对比

| 维度 | Claude Code Agent Teams | Tyranids 虫群系统 |
|------|------------------------|------------------|
| **架构** | 中心化 (Lead + Teammates) | ✅ **去中心化** (无 Lead) |
| **通信** | 点对点消息 | ✅ **信息素池** (间接通信) |
| **决策** | Lead 审批 | ✅ **涌现收敛** (自组织) |
| **成本** | ~7x 单会话 | ✅ **<3x** (分层模型 + 规则) |
| **容错** | 单点故障 (Lead) | ✅ **无单点故障** |
| **进化** | 静态配置 | ✅ **自我进化** (遗传算法) |

## 📈 性能指标

### MVP 目标

- ✅ **成本**: <$0.20 per task
- ✅ **速度**: <3 分钟
- ✅ **收敛**: <15 轮
- ✅ **并行**: 5 agents 同时执行
- ✅ **方案多样性**: 至少 3 种不同方案

### 实际结果 (待验证)

运行 `npm run test-swarm` 查看实际指标。

## 🔧 配置

### 虫群配置

```typescript
interface SwarmConfig {
  agentCount: number;           // Agent 数量 (默认 5)
  maxIterations: number;        // 最大迭代次数 (默认 20)
  convergenceThreshold: number; // 收敛阈值 (默认 0.8)
  explorationRate?: number;     // 探索率 (默认 0.15)
  modelPreference?: 'haiku-only' | 'sonnet-preferred';  // 模型偏好
}
```

### 环境变量

```bash
# 必需
export ANTHROPIC_API_KEY="your-api-key"

# 可选 - 自定义基因库位置
export TYRANIDS_GENE_POOL_DIR="~/.tyranids/gene-pool"
```

## 📚 文档

- [系统架构](./docs/architecture.md) - 核心概念和设计模式
- [Pi 框架 API](./docs/pi-framework-api.md) - Pi 框架使用指南
- [泰伦生物引擎](./docs/bioengine.md) - 基因吞噬与进化系统
- [MVP 验证清单](./docs/mvp-validation.md) - 功能验证和性能测试
- [技术蓝图](./BLUEPRINT.md) - 详细技术规范

## 🛠️ 开发

### 构建

```bash
# 构建所有包
npm run build

# 清理构建产物
npm run clean

# 监听模式
npm run build -- --watch
```

### 测试

```bash
# 运行单元测试
npm test

# 运行示例
cd examples/add-priority-feature
npm run test-swarm

# 演示生物引擎
npm run demo-bioengine
```

### 项目命令

```bash
# 根目录
npm run build          # 构建所有包
npm run clean          # 清理所有构建产物

# swarm-core
cd packages/swarm-core
npm run build          # 构建
npm test               # 运行测试

# 示例
cd examples/add-priority-feature
npm run test-swarm     # 运行虫群测试
npm run demo-bioengine # 演示生物引擎
```

## 🗺️ 路线图

### ✅ MVP (已完成)

- [x] PheromonePool (信息素池)
- [x] SwarmAgent (虫群个体)
- [x] SwarmOrchestrator (虫群编排器)
- [x] Observer & Metrics (观测和度量)
- [x] Pi Framework 集成
- [x] BioEngine (泰伦生物引擎)
- [x] 预定义兵种
- [x] 遗传算法优化

### 🚧 未来计划

- [ ] Agent Skills (Claude Code 技能)
- [ ] 环境适应 (Planetary Assimilation)
- [ ] 代码模式提取
- [ ] 动态兵种生成
- [ ] 多文件修改支持
- [ ] TUI 可视化界面
- [ ] Web UI 展示

## 🤝 贡献

欢迎贡献! 请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- **战锤40k 泰伦虫族**: 灵感来源
- **Pi Framework** (@mariozechner/pi-ai): LLM 统一接口
- **Claude Code**: Agent 开发平台
- **蚁群优化算法**: 理论基础

## 📞 联系

- 问题反馈: [GitHub Issues](https://github.com/yourusername/tyranids/issues)
- 讨论: [GitHub Discussions](https://github.com/yourusername/tyranids/discussions)

---

<a name="english"></a>

# 🦎 Tyranids - Swarm Intelligence Coding Agent System

> Inspired by Warhammer 40k Tyranids - A swarm-based AI coding agent system that evolves and adapts

## 🧬 Core Concept

Tyranids implements a **swarm intelligence** approach to code generation, inspired by the Tyranids from Warhammer 40k:

- **🧬 Gene Devouring**: Absorbs successful patterns from each execution
- **🧠 Hive Mind**: Shared knowledge through pheromone pools
- **🦠 Bioform Evolution**: Specialized agent "species" for different tasks
- **🌍 Planetary Adaptation**: Rapidly analyzes and adapts to new codebases
- **♾️ Infinite Reproduction**: Dynamically scales swarm based on task complexity

## ✨ Features

### 🐝 Swarm Collaboration

- **Decentralized Architecture**: No Lead Agent, all agents are equal
- **Pheromone Communication**: Indirect collaboration through shared pheromone pools
- **Emergent Convergence**: Best solutions naturally attract more agents
- **Parallel Exploration**: Simultaneously explore multiple different implementation paths

### 🧬 Self-Evolution

- **6 Predefined Bioforms**: Explorer, Refiner, Validator, Carnifex, Lictor, Hive Tyrant
- **Genetic Algorithm Optimization**: Automatically optimize swarm configuration parameters
- **Gene Pool Accumulation**: Share successful experiences across projects
- **Zero-Config Evolution**: Automatically triggers evolution every 10 executions

### 📊 Observability

- **Detailed Metrics**: Execution time, cost, convergence, quality distribution
- **Visualization**: ASCII charts showing pheromone evolution
- **Comprehensive Reports**: Agent behavior analysis, key insights
- **Real-time Monitoring**: Live tracking of convergence process

### 💰 Cost Optimization

- **Target Cost**: <$0.20 per task (vs Claude Code Agent Teams' 7x single session)
- **Tiered Models**: Haiku for exploration, Sonnet for refinement
- **Rule-based Decisions**: Behavior selection without LLM calls
- **Early Stopping**: Stop immediately when convergence is detected

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/tyranids.git
cd tyranids

# Install dependencies
npm install

# Build all packages
npm run build
```

### Run Example

```bash
cd examples/add-priority-feature

# Set API Key
export ANTHROPIC_API_KEY="your-api-key"

# Run swarm test
npm run test-swarm
```

### Basic Usage

```typescript
import { SwarmOrchestratorPi, type CodingTask, type SwarmConfig } from '@tyranids/swarm-core';

// Define task
const task: CodingTask = {
  description: 'Add priority feature to Todo interface',
  filePath: './todo.ts',
  baseCode: '...', // Original code
  type: 'add-feature',
};

// Swarm configuration
const config: SwarmConfig = {
  agentCount: 5,           // 5 agents exploring in parallel
  maxIterations: 20,       // Maximum 20 iterations
  convergenceThreshold: 0.8,
  explorationRate: 0.15,
  modelPreference: 'haiku-only',
};

// Create orchestrator
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic',
});

// Execute swarm
const topSolutions = await orchestrator.execute();

// Get best solution
console.log('Top-3 solutions:', topSolutions);
```

## 📦 Project Structure

See Chinese section for detailed structure.

## 🐝 How It Works

### 1. Pheromone Communication

Agents communicate indirectly through a shared pheromone pool, similar to how ants use pheromone trails.

### 2. Emergent Convergence

No central coordinator - convergence emerges naturally as agents are attracted to high-quality solutions.

### 3. Quality Evaluation

Solutions are evaluated on three dimensions:
- Compilation success (40% weight)
- Functional completeness (30% weight)
- Code simplicity (30% weight)

### 4. Gene Devouring & Evolution

System automatically records execution history and uses genetic algorithms to optimize configuration parameters every 10 executions.

## 🦠 Predefined Bioforms

- **Explorer**: High exploration rate, pursues diversity
- **Refiner**: Low exploration rate, pursues perfection
- **Validator**: Focus on testing and verification
- **Carnifex**: Large-scale parallel processing
- **Lictor**: Single-agent fast execution
- **Hive Tyrant**: Balanced general-purpose configuration

## 📊 vs Claude Code Agent Teams

| Dimension | Claude Code Agent Teams | Tyranids |
|-----------|------------------------|----------|
| **Architecture** | Centralized (Lead + Teammates) | ✅ **Decentralized** (No Lead) |
| **Communication** | Point-to-point messages | ✅ **Pheromone Pool** (Indirect) |
| **Decision** | Lead approval | ✅ **Emergent Convergence** (Self-organizing) |
| **Cost** | ~7x single session | ✅ **<3x** (Tiered models + Rules) |
| **Fault Tolerance** | Single point of failure (Lead) | ✅ **No single point** |
| **Evolution** | Static configuration | ✅ **Self-evolving** (Genetic algorithm) |

## 📚 Documentation

- [Architecture](./docs/architecture.md) - Core concepts and design patterns
- [Pi Framework API](./docs/pi-framework-api.md) - Pi framework usage guide
- [BioEngine](./docs/bioengine.md) - Gene devouring and evolution system
- [MVP Validation](./docs/mvp-validation.md) - Feature validation and performance testing
- [Technical Blueprint](./BLUEPRINT.md) - Detailed technical specifications

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- **Warhammer 40k Tyranids**: Source of inspiration
- **Pi Framework** (@mariozechner/pi-ai): Unified LLM interface
- **Claude Code**: Agent development platform
- **Ant Colony Optimization**: Theoretical foundation

---

**For the Hive Mind! 🧬**
