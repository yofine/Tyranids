# 层次化虫群协作设计（真正的协作）

**目标**：从"并行探索"升级为"有序协作"

---

## 🧬 核心理念：泰伦主宰意志

在战锤40k中，泰伦虫群通过**主宰意志（Hive Mind）**实现完美协作：

1. **Hive Tyrant（主宰）**: 战场指挥，分配任务
2. **Tyranid Warriors（战士）**: 中层指挥，协调小队
3. **Gaunts（杂兵）**: 基层单位，执行具体任务

对应到代码生成：

1. **Meta-Orchestrator**: 分解任务为阶段
2. **Sub-Swarms**: 每个阶段一个子虫群
3. **Agents**: 具体执行

---

## 📐 架构设计

### 层级结构

```
MetaOrchestrator（主宰级）
│
├─ Phase 1: InterfaceSwarm（接口设计虫群）
│   ├─ 3 agents 探索最佳接口定义
│   ├─ 收敛到统一的类型定义
│   └─ 输出: types.ts（Token, ASTNode 等接口）
│
├─ Phase 2: ImplementationSwarms（实现虫群 - 并行）
│   ├─ TokenizerSwarm (3 agents)
│   │   └─ 基于确定的 Token 接口实现 tokenizer.ts
│   ├─ ParserSwarm (3 agents)
│   │   └─ 基于 Token + ASTNode 接口实现 parser.ts
│   └─ EvaluatorSwarm (2 agents)
│       └─ 基于 ASTNode 接口实现 evaluator.ts
│
└─ Phase 3: IntegrationSwarm（集成虫群）
    ├─ 2 agents 尝试不同的集成方式
    └─ 输出: main.ts + 集成测试
```

### 信息流

```
           ┌──────────────┐
           │ MetaOrch     │ (任务分解)
           └───────┬──────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ Phase 1 │ │ Phase 2 │ │ Phase 3 │
  └────┬────┘ └────┬────┘ └────┬────┘
       │           │           │
       ▼           ▼           ▼
   Interface   Implement   Integrate
   (types.ts)  (3 files)   (main.ts)
       │           │           │
       └───────────┼───────────┘
                   │
                   ▼
            Complete Project
```

---

## 🔧 实现细节

### 1. MetaOrchestrator 类

```typescript
export interface HierarchicalTask {
  description: string;
  phases: TaskPhase[];
}

export interface TaskPhase {
  name: string;
  objective: string;
  dependencies: string[];  // 依赖哪些前置 phase
  assignedFiles: string[];
  agentCount: number;
  maxIterations: number;
}

export class MetaOrchestrator {
  private phases: TaskPhase[];
  private phaseResults: Map<string, PhaseResult> = new Map();

  async execute(task: HierarchicalTask): Promise<MultiFileCodeFragment> {
    console.log('🧠 Meta-Orchestrator: 分解任务...\n');

    // 阶段 0: 任务分析和分解
    this.phases = await this.decomposeTask(task);

    // 按依赖顺序执行各阶段
    const sortedPhases = this.topologicalSort(this.phases);

    for (const phase of sortedPhases) {
      console.log(`\n📍 Phase: ${phase.name}`);
      console.log(`   目标: ${phase.objective}`);
      console.log(`   文件: ${phase.assignedFiles.join(', ')}`);
      console.log(`   部署: ${phase.agentCount} agents\n`);

      // 等待依赖完成
      await this.waitForDependencies(phase.dependencies);

      // 执行子虫群
      const result = await this.executePhase(phase);
      this.phaseResults.set(phase.name, result);

      console.log(`   ✅ Phase ${phase.name} 完成\n`);
    }

    // 合并所有阶段的输出
    return this.mergeResults();
  }

  private async decomposeTask(task: HierarchicalTask): Promise<TaskPhase[]> {
    // 使用 LLM 分析任务，自动分解为阶段
    // 或使用预定义的模板（Level 1: Calculator）

    return [
      {
        name: 'interface-design',
        objective: '设计统一的类型接口（Token, ASTNode）',
        dependencies: [],
        assignedFiles: ['types.ts'],
        agentCount: 3,
        maxIterations: 10,
      },
      {
        name: 'tokenizer-impl',
        objective: '实现词法分析器',
        dependencies: ['interface-design'],
        assignedFiles: ['tokenizer.ts'],
        agentCount: 3,
        maxIterations: 12,
      },
      {
        name: 'parser-impl',
        objective: '实现语法分析器',
        dependencies: ['interface-design', 'tokenizer-impl'],
        assignedFiles: ['parser.ts'],
        agentCount: 3,
        maxIterations: 12,
      },
      {
        name: 'evaluator-impl',
        objective: '实现表达式求值器',
        dependencies: ['interface-design'],
        assignedFiles: ['evaluator.ts'],
        agentCount: 2,
        maxIterations: 10,
      },
      {
        name: 'integration',
        objective: '集成所有模块并提供 CLI',
        dependencies: ['tokenizer-impl', 'parser-impl', 'evaluator-impl'],
        assignedFiles: ['main.ts'],
        agentCount: 2,
        maxIterations: 8,
      },
    ];
  }

  private async executePhase(phase: TaskPhase): Promise<PhaseResult> {
    // 创建子虫群
    const subSwarm = new SubSwarmOrchestrator({
      phaseName: phase.name,
      objective: phase.objective,
      assignedFiles: phase.assignedFiles,
      agentCount: phase.agentCount,
      maxIterations: phase.maxIterations,
      context: this.buildContext(phase),  // 传入前置阶段的结果
    });

    return await subSwarm.execute();
  }

  private buildContext(phase: TaskPhase): PhaseContext {
    // 构建上下文：包含所有依赖 phase 的输出
    const context: PhaseContext = {
      completedFiles: {},
      interfaces: {},
    };

    for (const depName of phase.dependencies) {
      const depResult = this.phaseResults.get(depName);
      if (depResult) {
        // 合并依赖的输出
        Object.assign(context.completedFiles, depResult.files);
        Object.assign(context.interfaces, depResult.exportedInterfaces);
      }
    }

    return context;
  }

  private topologicalSort(phases: TaskPhase[]): TaskPhase[] {
    // 拓扑排序，确保依赖关系正确
    const sorted: TaskPhase[] = [];
    const visited = new Set<string>();

    const visit = (phase: TaskPhase) => {
      if (visited.has(phase.name)) return;

      // 先访问所有依赖
      for (const depName of phase.dependencies) {
        const dep = phases.find(p => p.name === depName);
        if (dep) visit(dep);
      }

      visited.add(phase.name);
      sorted.push(phase);
    };

    phases.forEach(visit);
    return sorted;
  }
}
```

### 2. SubSwarmOrchestrator 类

每个 Phase 使用一个子虫群：

```typescript
export interface SubSwarmConfig {
  phaseName: string;
  objective: string;
  assignedFiles: string[];
  agentCount: number;
  maxIterations: number;
  context: PhaseContext;  // 前置阶段的结果
}

export interface PhaseContext {
  completedFiles: { [path: string]: string };  // 已完成的文件
  interfaces: { [name: string]: string };      // 已确定的接口
}

export class SubSwarmOrchestrator {
  private agents: SwarmAgent[] = [];
  private pheromonePool: PheromonePool;
  private config: SubSwarmConfig;

  async execute(): Promise<PhaseResult> {
    // 创建专门的 prompt，包含上下文
    const taskPrompt = this.buildTaskPrompt();

    // 生成 agents
    for (let i = 0; i < this.config.agentCount; i++) {
      this.agents.push(
        new SwarmAgent({
          id: `${this.config.phaseName}-agent-${i}`,
          pheromonePool: this.pheromonePool,
          task: {
            description: taskPrompt,
            filePath: this.config.assignedFiles[0],  // 主要文件
            baseCode: '',
          },
        })
      );
    }

    // 并行执行
    await Promise.all(
      this.agents.map(a => a.execute(this.config.maxIterations))
    );

    // 提取最佳方案
    const best = this.pheromonePool.getTop(1)[0];

    return {
      phaseName: this.config.phaseName,
      files: this.parseGeneratedFiles(best.codeFragment.content),
      exportedInterfaces: this.extractInterfaces(best.codeFragment.content),
      quality: best.quality,
    };
  }

  private buildTaskPrompt(): string {
    let prompt = `Phase: ${this.config.phaseName}\nObjective: ${this.config.objective}\n\n`;

    // 添加已完成文件的上下文
    if (Object.keys(this.config.context.completedFiles).length > 0) {
      prompt += '## 已完成的文件（请依赖这些接口）\n\n';
      for (const [path, content] of Object.entries(this.config.context.completedFiles)) {
        prompt += `### ${path}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
      }
    }

    // 添加接口约束
    if (Object.keys(this.config.context.interfaces).length > 0) {
      prompt += '## 必须遵守的接口定义\n\n';
      for (const [name, definition] of Object.entries(this.config.context.interfaces)) {
        prompt += `\`\`\`typescript\n${definition}\n\`\`\`\n\n`;
      }
    }

    // 任务要求
    prompt += `## 任务\n\n生成以下文件: ${this.config.assignedFiles.join(', ')}\n\n`;
    prompt += `要求:\n`;
    prompt += `- 正确导入已有的接口和模块\n`;
    prompt += `- 确保与上游文件兼容\n`;
    prompt += `- 保持代码简洁和类型安全\n`;

    return prompt;
  }

  private extractInterfaces(code: string): { [name: string]: string } {
    // 从代码中提取 export 的接口和类型
    const interfaces: { [name: string]: string } = {};

    // 匹配 export interface/type
    const interfaceRegex = /export\s+(interface|type)\s+(\w+)\s*[={]/g;
    let match;

    while ((match = interfaceRegex.exec(code)) !== null) {
      const name = match[2];
      // 简化：只记录接口名称（完整实现需要提取定义）
      interfaces[name] = `export ${match[1]} ${name} { ... }`;
    }

    return interfaces;
  }
}
```

### 3. 修改后的执行流程

```typescript
// Level 1 测试脚本

import { MetaOrchestrator } from '@tyranids/swarm-core';

const task: HierarchicalTask = {
  description: 'Implement a command-line calculator',
  phases: [
    // 自动分解，或手动定义
  ],
};

const meta = new MetaOrchestrator({
  provider: 'minimax',
  modelName: 'MiniMax-M2.1',
});

const result = await meta.execute(task);

console.log('✅ 项目完成，生成文件:');
result.files.forEach(f => console.log(`  - ${f.filePath}`));
```

---

## 📊 协作效果对比

### 当前方式（伪协作）

```
Timeline:
  ├─ [0-100s] 所有 5 agents 并行生成完整 4 文件方案
  └─ [100s]   选择最佳方案

结果: 5 个完整方案（大量重复工作）
协作: ❌ 无协作，只是投票
```

### 层次化方式（真协作）

```
Timeline:
  ├─ [0-30s]   Phase 1: 3 agents 探索接口设计 → 确定 Token/ASTNode
  ├─ [30-60s]  Phase 2: 8 agents 并行实现 tokenizer/parser/evaluator
  │              ├─ Tokenizer Swarm (3 agents) - 依赖 Token 接口
  │              ├─ Parser Swarm (3 agents) - 依赖 Token + ASTNode
  │              └─ Evaluator Swarm (2 agents) - 依赖 ASTNode
  └─ [60-80s]  Phase 3: 2 agents 集成所有模块 → main.ts

结果: 4 个文件，高度一致
协作: ✅ 真正的任务分解和有序协作
```

**优势**：
- ✅ **避免重复**：不会有 5 个 agent 都去实现 tokenizer
- ✅ **接口一致**：先确定接口，再分头实现
- ✅ **并行效率**：Phase 2 中 3 个 swarms 真正并行
- ✅ **质量更高**：每个文件由专门的 swarm 负责

---

## 🎯 实施计划

### Phase A: 核心架构（2天）

1. 实现 `MetaOrchestrator` 类
2. 实现 `SubSwarmOrchestrator` 类
3. 定义 `HierarchicalTask` 和 `PhaseContext` 类型

### Phase B: 上下文传递（1天）

1. 实现 `buildContext()` - 将前置阶段结果传给后续阶段
2. 修改 prompt 模板，包含已完成文件的信息
3. 实现接口提取逻辑

### Phase C: Level 1 测试（1天）

1. 定义 Calculator 的 phase 分解
2. 运行层次化虫群
3. 对比与当前方式的效果差异

### Phase D: 可视化（可选）

```
Phase 1: Interface Design  [========] 100% (30s)
  ├─ agent-0: EXPLORE → Token 类型
  ├─ agent-1: REFINE → 优化 Token
  └─ agent-2: EXPLORE → ASTNode 类型
  ✅ 收敛: Token + ASTNode 接口确定

Phase 2: Implementation    [====----] 60% (18s/30s)
  ├─ Tokenizer Swarm       [======--] 75%
  ├─ Parser Swarm          [====----] 50%
  └─ Evaluator Swarm       [========] 100%
```

---

## 💡 关键创新点

### 1. 阶段性信息素

不再是全局信息素池，而是每个 Phase 有自己的池：

```typescript
class MetaOrchestrator {
  private phasePools: Map<string, PheromonePool> = new Map();

  // Phase 1 的信息素影响 Phase 2 的决策
  buildContext(phase: TaskPhase) {
    const depPools = phase.dependencies.map(d => this.phasePools.get(d));
    return mergePheromonePools(depPools);
  }
}
```

### 2. 接口先行（Interface-First）

```typescript
// Phase 1: 所有 agents 探索接口设计
interface Token { type: TokenType; value?: string; }
interface ASTNode { type: 'NUMBER' | 'BINARY_OP'; ... }

// Phase 2: 所有 agents 基于确定的接口实现
// 不会出现 tokenizer 返回对象但 parser 期望数组的不兼容
```

### 3. 依赖感知调度

```typescript
// 拓扑排序保证依赖关系
const sorted = topologicalSort(phases);

// Parser 永远在 Tokenizer 之后执行
// 因为 parser-impl 依赖 tokenizer-impl
```

---

## 🏆 成功标准

层次化虫群被认为成功当：

1. ✅ **无重复工作**: 没有 agent 重复实现同一个文件
2. ✅ **接口一致**: 所有文件使用统一的 Token/ASTNode 定义
3. ✅ **真正并行**: Phase 2 的 3 个 swarms 同时运行
4. ✅ **质量提升**: 每个文件质量 > 当前方式（因为专门的 swarm 负责）
5. ✅ **时间优化**: 总耗时 < 当前方式（避免了重复生成）
6. ✅ **可扩展**: 能轻松扩展到 Level 2 (10 文件) 和 Level 3 (15 文件)

---

**这才是真正的虫群协作！** 🧬
