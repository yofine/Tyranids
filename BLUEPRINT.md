# 虫群编程Agent技术蓝图

基于 pi-mono 框架的虫群智能编程系统实现方案

---

## 1. 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Swarm Orchestrator                       │
│              (改造自 pi-agent-core)                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌──────────────────┐
│ Pheromone Pool│   │  Agent Spawner   │
│ (共享状态存储) │   │  (动态实例管理)   │
└───────┬───────┘   └────────┬─────────┘
        │                    │
        └────────┬───────────┘
                 ▼
    ┌────────────────────────┐
    │   Swarm Agents (5-20)  │
    │  (改造自 pi-coding-agent)│
    └────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  Tool Layer │   │ Evaluation   │
│ (文件/bash)  │   │  (测试/编译)  │
└─────────────┘   └──────────────┘
```

---

## 2. 核心模块设计

### 2.1 Swarm Agent（虫群个体）
**基础**: 改造 `@mariozechner/pi-coding-agent`

```typescript
// packages/swarm-agent/src/swarm-agent.ts

interface SwarmAgent {
  id: string;
  state: AgentState;
  
  // 虫群特性
  pheromoneReceptors: PheromoneReceptor[];  // 感知信息素
  behaviorRules: BehaviorRule[];            // 简单行为规则
  localMemory: CodeFragment[];              // 局部上下文
  
  // 继承自 pi-agent-core
  llm: LLMClient;                           // 来自 pi-ai
  tools: Tool[];                            // bash, read_file 等
}

enum AgentState {
  EXPLORING,   // 探索新代码路径
  REFINING,    // 优化已有方案
  VALIDATING,  // 验证解决方案
  IDLE         // 等待任务
}

class SwarmCodingAgent extends Agent {
  async execute() {
    while (true) {
      // 1. 读取信息素
      const pheromones = await this.readPheromones();
      
      // 2. 决策行为（基于简单规则，非复杂规划）
      const action = this.decideAction(pheromones);
      
      // 3. 执行工具调用
      const result = await this.performAction(action);
      
      // 4. 写入信息素
      await this.depositPheromone(result);
      
      // 5. 状态转换
      this.transitionState(result);
    }
  }
  
  private decideAction(pheromones: Pheromone[]): Action {
    // 简单规则组合：
    // - 70%概率跟随高质量信息素
    // - 20%概率探索低覆盖区域
    // - 10%概率随机探索
    const random = Math.random();
    
    if (random < 0.7 && pheromones.length > 0) {
      return this.followStrongestTrail(pheromones);
    } else if (random < 0.9) {
      return this.exploreWeakArea();
    } else {
      return this.randomExplore();
    }
  }
}
```

**行为规则定义**:
```typescript
interface BehaviorRule {
  condition: (context: LocalContext) => boolean;
  action: (context: LocalContext) => Promise<Action>;
  priority: number;
}

// 示例规则
const EXPLORATION_RULES: BehaviorRule[] = [
  {
    // 规则1: 跟随信息素
    condition: (ctx) => ctx.nearbyPheromones.some(p => p.quality > 0.7),
    action: async (ctx) => {
      const best = ctx.nearbyPheromones.reduce((a, b) => 
        a.quality > b.quality ? a : b
      );
      return { type: 'REFINE', target: best.codeFragment };
    },
    priority: 10
  },
  {
    // 规则2: 探索未覆盖区域
    condition: (ctx) => ctx.coverageMap.minCoverage < 0.3,
    action: async (ctx) => {
      const unexplored = ctx.coverageMap.getLowestCoverageArea();
      return { type: 'EXPLORE', target: unexplored };
    },
    priority: 5
  },
  {
    // 规则3: 验证高质量方案
    condition: (ctx) => ctx.hasUntestedHighQualitySolution(),
    action: async (ctx) => ({
      type: 'VALIDATE',
      target: ctx.getUntestedSolution()
    }),
    priority: 15
  }
];
```

---

### 2.2 Pheromone Pool（信息素池）
**基础**: 改造 `@mariozechner/pi-mom`（原用于LLM部署管理，改为状态共享）

```typescript
// packages/pheromone-pool/src/pool.ts

interface Pheromone {
  id: string;
  codeFragment: CodeFragment;       // 代码片段
  quality: number;                  // 0-1质量评分
  depositors: string[];             // 贡献agent列表
  timestamp: number;
  
  // 评估指标
  metrics: {
    compiles: boolean;
    testsPass: boolean;
    complexity: number;             // 代码复杂度
    coverage: number;               // 测试覆盖率
  };
  
  // 衰减机制
  evaporationRate: number;          // 信息素蒸发速率
}

interface CodeFragment {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  modificationIntent: string;       // "修复bug" | "重构" | "添加功能"
}

class PheromonePool {
  private store: Map<string, Pheromone> = new Map();
  private evaporationInterval: NodeJS.Timer;
  
  constructor() {
    // 启动信息素蒸发线程
    this.evaporationInterval = setInterval(
      () => this.evaporate(), 
      5000  // 每5秒蒸发一次
    );
  }
  
  async deposit(pheromone: Pheromone): Promise<void> {
    const existing = this.store.get(pheromone.id);
    
    if (existing) {
      // 强化已有路径
      existing.quality = Math.min(1.0, existing.quality + 0.1);
      existing.depositors.push(...pheromone.depositors);
    } else {
      this.store.set(pheromone.id, pheromone);
    }
  }
  
  async read(filter: PheromoneFilter): Promise<Pheromone[]> {
    // 支持空间查询（nearby）和质量过滤
    return Array.from(this.store.values())
      .filter(p => this.matchesFilter(p, filter))
      .sort((a, b) => b.quality - a.quality);
  }
  
  private evaporate(): void {
    // 衰减低质量信息素
    for (const [id, pheromone] of this.store) {
      pheromone.quality *= (1 - pheromone.evaporationRate);
      
      if (pheromone.quality < 0.1) {
        this.store.delete(id);  // 清除失败路径
      }
    }
  }
  
  // 空间查询：查找特定代码区域附近的信息素
  getNearby(fragment: CodeFragment, radius: number): Pheromone[] {
    return Array.from(this.store.values()).filter(p => {
      return p.codeFragment.filePath === fragment.filePath &&
             Math.abs(p.codeFragment.startLine - fragment.startLine) < radius;
    });
  }
}
```

**信息素质量计算**:
```typescript
function calculateQuality(metrics: Pheromone['metrics']): number {
  let score = 0;
  
  if (metrics.compiles) score += 0.3;
  if (metrics.testsPass) score += 0.4;
  
  // 低复杂度加分
  score += (1 - Math.min(metrics.complexity / 100, 1)) * 0.15;
  
  // 高覆盖率加分
  score += metrics.coverage * 0.15;
  
  return Math.min(score, 1.0);
}
```

---

### 2.3 Swarm Orchestrator（虫群编排器）
**基础**: 改造 `@mariozechner/pi-agent-core` 的 Agent 类

```typescript
// packages/swarm-orchestrator/src/orchestrator.ts

class SwarmOrchestrator {
  private agents: SwarmCodingAgent[] = [];
  private pheromonePool: PheromonePool;
  private taskQueue: Task[];
  
  constructor(
    private config: SwarmConfig,
    private llmProvider: LLMClient  // 来自 pi-ai
  ) {
    this.pheromonePool = new PheromonePool();
  }
  
  async execute(task: CodingTask): Promise<Solution[]> {
    // 1. 初始化虫群
    this.spawnAgents(this.config.agentCount);
    
    // 2. 注入初始信息素（将任务分解为种子）
    await this.seedTask(task);
    
    // 3. 启动所有agents（并行执行）
    const agentPromises = this.agents.map(agent => 
      agent.execute().catch(err => this.handleAgentFailure(agent, err))
    );
    
    // 4. 监控收敛
    const solutions = await this.monitorConvergence(agentPromises);
    
    // 5. 提取最优解
    return this.extractBestSolutions(solutions);
  }
  
  private async seedTask(task: CodingTask): Promise<void> {
    // 将任务转换为初始信息素
    // 例如：bug修复任务 -> 标记错误代码区域为探索目标
    const seeds: Pheromone[] = task.affectedFiles.map(file => ({
      id: `seed-${file}`,
      codeFragment: { filePath: file, startLine: 0, endLine: -1, content: '', modificationIntent: task.intent },
      quality: 0.5,  // 中等吸引力
      depositors: ['orchestrator'],
      timestamp: Date.now(),
      metrics: { compiles: false, testsPass: false, complexity: 0, coverage: 0 },
      evaporationRate: 0.05
    }));
    
    await Promise.all(seeds.map(s => this.pheromonePool.deposit(s)));
  }
  
  private async monitorConvergence(
    agentPromises: Promise<void>[]
  ): Promise<Solution[]> {
    const convergenceThreshold = 0.85;  // 85%的agents聚集在同一方案
    const maxIterations = 50;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 每2秒检查一次
      
      // 检查信息素分布
      const topPheromones = await this.pheromonePool.read({ 
        minQuality: 0.7, 
        limit: 5 
      });
      
      if (topPheromones.length > 0) {
        const convergenceRatio = topPheromones[0].depositors.length / this.agents.length;
        
        if (convergenceRatio > convergenceThreshold) {
          console.log(`Converged at iteration ${iteration}`);
          break;
        }
      }
      
      iteration++;
    }
    
    // 停止所有agents
    this.agents.forEach(a => a.stop());
    
    // 收集方案
    return this.collectSolutions();
  }
  
  private spawnAgents(count: number): void {
    for (let i = 0; i < count; i++) {
      this.agents.push(new SwarmCodingAgent({
        id: `agent-${i}`,
        llm: this.llmProvider,
        pheromonePool: this.pheromonePool,
        tools: [readFileTool, bashTool, grepTool], // 来自 pi-coding-agent
        behaviorRules: EXPLORATION_RULES
      }));
    }
  }
  
  private handleAgentFailure(agent: SwarmCodingAgent, error: Error): void {
    // 虫群容错：单个agent失败不影响整体
    console.warn(`Agent ${agent.id} failed: ${error.message}`);
    
    // 可选：重新生成agent
    if (this.config.autoRespawn) {
      const newAgent = new SwarmCodingAgent(agent.config);
      this.agents.push(newAgent);
      newAgent.execute();
    }
  }
}

interface SwarmConfig {
  agentCount: number;           // 虫群规模（建议5-20）
  convergenceThreshold: number;
  maxIterations: number;
  autoRespawn: boolean;         // agent失败自动重生
  explorationRate: number;      // 探索vs利用平衡
}
```

---

### 2.4 Evaluation Layer（评估层）

```typescript
// packages/swarm-evaluator/src/evaluator.ts

class SolutionEvaluator {
  async evaluate(solution: CodeFragment): Promise<EvaluationResult> {
    const results = await Promise.all([
      this.checkCompilation(solution),
      this.runTests(solution),
      this.analyzeComplexity(solution),
      this.measureCoverage(solution)
    ]);
    
    return {
      compiles: results[0],
      testsPass: results[1],
      complexity: results[2],
      coverage: results[3],
      overallQuality: calculateQuality({
        compiles: results[0],
        testsPass: results[1],
        complexity: results[2],
        coverage: results[3]
      })
    };
  }
  
  private async checkCompilation(solution: CodeFragment): Promise<boolean> {
    // 利用 pi-coding-agent 的 bash tool
    const result = await this.tools.bash.execute({
      command: `tsc --noEmit ${solution.filePath}`
    });
    return result.exitCode === 0;
  }
  
  private async runTests(solution: CodeFragment): Promise<boolean> {
    // 运行相关测试
    const result = await this.tools.bash.execute({
      command: `npm test -- ${solution.filePath.replace('.ts', '.test.ts')}`
    });
    return result.exitCode === 0;
  }
  
  private analyzeComplexity(solution: CodeFragment): number {
    // 简单的圈复杂度计算
    const code = solution.content;
    const controlFlowKeywords = ['if', 'for', 'while', 'switch', '&&', '||'];
    
    return controlFlowKeywords.reduce((count, keyword) => {
      const matches = code.match(new RegExp(keyword, 'g'));
      return count + (matches ? matches.length : 0);
    }, 1);
  }
}
```

---

## 3. 包依赖关系

```
@mariozechner/pi-ai (unchanged)
    ↓
@mariozechner/swarm-pheromone-pool (new, 替代 pi-mom)
    ↓
@mariozechner/swarm-agent (new, 改造 pi-agent-core)
    ↓
@mariozechner/swarm-coding-agent (new, 改造 pi-coding-agent)
    ↓
@mariozechner/swarm-orchestrator (new)
    ↓
@mariozechner/swarm-cli (new, 替代 pi)
```

**保持不变的包**:
- `@mariozechner/pi-ai` - 统一LLM接口
- `@mariozechner/pi-tui` - 可复用的终端UI

---

## 4. 实现路线图

### Phase 1: 基础设施（2-3周）
- [ ] 搭建 monorepo 结构（复制 pi-mono 配置）
- [ ] 实现 PheromonePool 基础功能
  - 信息素存储
  - 读写接口
  - 蒸发机制
- [ ] 实现 SwarmAgent 基类
  - 状态管理
  - 简单行为规则引擎
  - 与 PheromonePool 通信

### Phase 2: 核心逻辑（3-4周）
- [ ] 实现 3 个核心行为规则
  - 跟随信息素
  - 探索未知区域
  - 验证方案
- [ ] 实现 SwarmOrchestrator
  - Agent生成管理
  - 收敛检测
  - 方案提取
- [ ] 集成评估层
  - 编译检查
  - 测试执行
  - 质量计算

### Phase 3: 工具集成（2周）
- [ ] 复用 pi-coding-agent 工具
  - read_file
  - bash
  - ripgrep
- [ ] 添加虫群专用工具
  - pheromone_read
  - pheromone_deposit
  - coverage_map

### Phase 4: 验证与优化（4周）
- [ ] **测试场景1**: 简单bug修复
  - 目标：修复已知TypeError
  - 预期：10个agents，30秒内收敛
- [ ] **测试场景2**: 代码重构
  - 目标：重构100行函数
  - 预期：agents探索5种方案，择优
- [ ] **测试场景3**: 新功能开发
  - 目标：实现REST API endpoint
  - 预期：并行探索多种实现路径

- [ ] 性能优化
  - LLM调用成本控制
  - 信息素池内存优化
  - 并行度调优

### Phase 5: UI与DevX（2周）
- [ ] 复用 pi-tui 实现可视化
  - 信息素热力图
  - Agent状态监控
  - 实时日志
- [ ] CLI工具
  ```bash
  swarm-code --task "修复auth.ts的验证bug" --agents 10
  ```

---

## 5. 关键技术决策

### 5.1 信息素存储方案

| 方案 | 优点 | 缺点 | 选择 |
|:---|:---|:---|:---|
| 内存Map | 速度快，实现简单 | 无法跨进程 | ✅ MVP阶段 |
| Redis | 支持分布式 | 需要额外依赖 | Phase 6 |
| SQLite | 持久化，可回溯 | 查询性能较低 | 可选 |

### 5.2 LLM调用策略

**成本控制**:
- 每个agent使用轻量模型（如 GPT-4o-mini 或 Claude Haiku）
- 只在关键决策节点调用LLM
- 简单规则判断不调用LLM

**并行限制**:
```typescript
const MAX_CONCURRENT_LLM_CALLS = 5;  // 避免rate limit
const callQueue = new PQueue({ concurrency: MAX_CONCURRENT_LLM_CALLS });
```

### 5.3 收敛检测算法

```typescript
// 基于信息素集中度的收敛判定
function isConverged(pool: PheromonePool): boolean {
  const all = pool.getAll();
  const top = pool.getTop(3);
  
  // 检查：前3个信息素是否占据80%的总质量
  const topQualitySum = top.reduce((sum, p) => sum + p.quality, 0);
  const totalQuality = all.reduce((sum, p) => sum + p.quality, 0);
  
  return topQualitySum / totalQuality > 0.8;
}
```

---

## 6. 成功指标

### 功能性指标
- [ ] 能够成功修复至少5种类型的编程bug
- [ ] 并行探索至少3种不同解决方案
- [ ] 收敛时间 < 2分钟（10个agents）

### 性能指标
- [ ] LLM调用成本 < 传统Agent Teams 的 60%
- [ ] 首个可用方案产出时间 < 30秒
- [ ] Agent失败率 < 20%（容错机制生效）

### 虫群特性验证
- [ ] 观测到信息素强化现象（成功路径被多个agents跟随）
- [ ] 观测到涌现行为（agents自发形成合作模式）
- [ ] 无中心调度情况下完成任务分配

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|:---|:---|:---|
| Agents陷入局部最优 | 无法找到最佳方案 | 增加随机探索率，定期注入扰动 |
| 信息素池爆炸增长 | 内存耗尽 | 实现更激进的蒸发策略，限制池大小 |
| LLM调用成本过高 | 经济不可行 | 使用缓存、减少冗余调用、规则优先 |
| 收敛过慢 | 用户体验差 | 动态调整agent数量，优化信息素质量计算 |
| 解决方案质量不稳定 | 无法生产使用 | 加强评估层，引入人类审核机制 |

---

## 8. 与传统Agent Teams对比

| 维度 | 传统Teams | 虫群模式 | 优势方 |
|:---|:---|:---|:---|
| 架构复杂度 | 高（需设计工作流） | 低（只定义规则） | 虫群 |
| 并行能力 | 受角色限制 | 无限制 | 虫群 |
| 容错性 | 单点故障风险 | 自愈能力 | 虫群 |
| 可解释性 | 中等 | 低 | 传统 |
| LLM调用次数 | 多（复杂规划） | 中（简单决策） | 虫群 |
| 方案多样性 | 低（预设路径） | 高（并行探索） | 虫群 |

---

## 9. 下一步行动

1. **立即开始**
   ```bash
   git clone https://github.com/badlogic/pi-mono
   cd pi-mono
   npm install
   npm run build
   
   # 创建新分支
   git checkout -b feature/swarm-intelligence
   ```

2. **创建第一个包**
   ```bash
   mkdir -p packages/swarm-pheromone-pool
   cd packages/swarm-pheromone-pool
   npm init -y
   ```

3. **实现最小可行原型（MVP）**
   - 3个agents
   - 内存信息素池
   - 1个简单规则：跟随最强信息素
   - 测试任务：修复一个简单的TypeScript错误

4. **验证核心假设**
   - agents能否通过信息素协作？
   - 收敛机制是否有效？
   - 成本是否可控？

