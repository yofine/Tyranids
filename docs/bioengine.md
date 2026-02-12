# 泰伦生物引擎 (Tyranid BioEngine)

🧬 **基因吞噬与进化系统** - 让虫群从成功的执行中提取"基因"并进化

## 灵感来源

灵感来自战锤40k的泰伦虫族（Tyranids）：

- **吞噬基因物质**: 从成功的代码方案中提取模式（"基因"）
- **快速适应**: 分析新代码库的"生物组成"，生成适应性兵种
- **主宰意志 (Hive Mind)**: 所有虫子共享进化后的知识
- **兵种多样化**: 根据任务类型生成专门化的 Agent 单位

## 核心理念

虫群不是静态的程序，而是持续进化的有机体：

1. 从每次任务中"吞噬"成功模式
2. 识别代码库的"生态环境"（架构、测试风格、编码规范）
3. 快速进化出专门化的 Agent "兵种"
4. 使用遗传算法优化虫群配置参数

## 预定义兵种

### Explorer (探索者)

**类比**: 泰伦的 Genestealer（基因窃取者）

```typescript
{
  name: 'Explorer',
  role: '探索者 - 快速探索多种实现路径',
  traits: {
    explorationRate: 0.40,    // 高探索率
    qualityThreshold: 0.60,   // 低质量阈值,追求多样性
    speed: 'fast',
    cost: 'low',
    agentCount: 3,
    maxIterations: 15,
  },
  适用场景: ['新功能开发', '需要创新方案', '探索性任务']
}
```

**特点**: 快速、廉价、多样性强

### Refiner (精炼者)

**类比**: 泰伦的 Tyranid Warrior（泰伦战士）

```typescript
{
  name: 'Refiner',
  role: '精炼者 - 优化已有方案，追求完美',
  traits: {
    explorationRate: 0.05,    // 低探索率
    qualityThreshold: 0.95,   // 高质量阈值
    speed: 'slow',
    cost: 'medium',
    agentCount: 5,
    maxIterations: 30,
  },
  适用场景: ['代码重构', '性能优化', '质量提升']
}
```

**特点**: 精益求精，愿意花更多轮次优化

### Validator (验证者)

**类比**: 泰伦的 Gargoyle（石像鬼）

```typescript
{
  name: 'Validator',
  role: '验证者 - 测试和验证方案可靠性',
  traits: {
    explorationRate: 0.10,
    qualityThreshold: 0.90,
    speed: 'normal',
    cost: 'low',
    agentCount: 3,
    maxIterations: 20,
  },
  适用场景: ['Bug修复', '测试验证', '安全审查']
}
```

**特点**: 专注验证，确保可靠性

### Carnifex (重型突击兵)

**类比**: 泰伦的 Carnifex（屠杀者）

```typescript
{
  name: 'Carnifex',
  role: '重型突击兵 - 处理复杂、大规模的代码任务',
  traits: {
    explorationRate: 0.20,
    qualityThreshold: 0.85,
    speed: 'normal',
    cost: 'high',
    agentCount: 15,           // 大规模并行
    maxIterations: 25,
  },
  适用场景: ['大规模重构', '整个模块重写', '复杂系统设计']
}
```

**特点**: 高资源消耗，适合复杂任务

### Lictor (刺客)

**类比**: 泰伦的 Lictor（猎杀者）

```typescript
{
  name: 'Lictor',
  role: '刺客 - 快速、精准的小型修改',
  traits: {
    explorationRate: 0.05,
    qualityThreshold: 0.80,
    speed: 'extreme',
    cost: 'low',
    agentCount: 1,            // 单 Agent
    maxIterations: 10,
  },
  适用场景: ['简单bug修复', '小型改动', '快速迭代']
}
```

**特点**: 极速执行，最小成本

### Hive Tyrant (主宰暴君)

**类比**: 泰伦的 Hive Tyrant（主宰暴君）

```typescript
{
  name: 'Hive Tyrant',
  role: '主宰暴君 - 统筹全局的平衡兵种',
  traits: {
    explorationRate: 0.15,
    qualityThreshold: 0.85,
    speed: 'normal',
    cost: 'medium',
    agentCount: 5,
    maxIterations: 20,
  },
  适用场景: ['一般性任务', '未知任务类型', '平衡方案']
}
```

**特点**: 平衡各项指标，通用性强

## 基因吞噬机制

### 执行记录

每次虫群执行完成后，系统自动记录：

```typescript
interface ExecutionRecord {
  id: string;
  timestamp: number;
  taskType: TaskType;        // 'add-feature' | 'refactor' | 'bugfix' | 'optimize'
  task: CodingTask;
  config: SwarmConfig;       // 使用的配置参数
  results: SwarmMetrics;     // 执行结果
  score: number;             // 综合评分 0-1
}
```

### 评分计算

综合质量、速度、成本三个维度：

```typescript
score = 0.4 × quality + 0.3 × speed + 0.3 × cost

quality = topPheromone.quality
speed = 1 - (convergenceIteration / 20)
cost = 1 - (estimatedCost / $0.15)
```

### 自动触发进化

- 每执行 10 次自动触发一次进化
- 使用遗传算法优化配置参数
- 按任务类型分别进化

## 遗传算法优化

### 算法流程

1. **选择 (Selection)**: 保留评分最高的 20% 配置作为"精英"
2. **交叉 (Crossover)**: 随机选择两个父代，单点交叉生成子代
3. **变异 (Mutation)**: 10% 概率随机扰动参数
4. **预测评分 (Fitness)**: 使用 K 近邻算法预测配置性能
5. **迭代**: 重复 5 代，返回最佳配置

### 配置空间

优化的参数：

- `agentCount`: 3-10
- `explorationRate`: 0.05-0.5
- `convergenceThreshold`: 0.6-0.95
- `maxIterations`: 10-30

### K 近邻预测

使用配置距离预测性能：

```typescript
distance(a, b) = √(
  ((a.agentCount - b.agentCount) / 10)² +
  (a.explorationRate - b.explorationRate)² +
  (a.convergenceThreshold - b.convergenceThreshold)² +
  ((a.maxIterations - b.maxIterations) / 30)²
)
```

找到距离最近的 5 个历史配置，加权平均其评分作为预测值。

## API 使用

### 基本使用

```typescript
import { TyranidBioEngine } from '@tyranids/swarm-core';

const bioEngine = new TyranidBioEngine();

// 初始化基因库目录
await bioEngine.initialize();

// 记录执行（在 Orchestrator 执行完成后调用）
await bioEngine.recordExecution(task, config, metrics);

// 查看执行统计
const stats = await bioEngine.getStatistics();
console.log(`总执行次数: ${stats.totalExecutions}`);
console.log(`平均评分: ${stats.avgScore.toFixed(2)}`);

// 分析进化机会
const analysis = await bioEngine.analyzeEvolutionOpportunities();
console.log(analysis);

// 手动触发进化
await bioEngine.triggerEvolution();

// 加载进化后的配置
const evolvedConfig = await bioEngine.loadEvolvedConfig('add-feature');
if (evolvedConfig) {
  console.log('使用进化后的配置:', evolvedConfig);
}
```

### 集成到 Orchestrator

SwarmOrchestratorPi 已自动集成生物引擎：

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'anthropic',
  enableEvolution: true,  // 默认启用（可选参数）
});

await orchestrator.execute();

// 执行完成后自动记录到基因库
// 每 10 次执行自动触发进化
```

### 使用进化后的配置

```typescript
// 加载进化后的配置
const evolvedConfig = await SwarmOrchestratorPi.loadEvolvedConfig('add-feature');

// 合并到用户配置
const finalConfig = {
  agentCount: evolvedConfig?.agentCount || 5,
  explorationRate: evolvedConfig?.explorationRate || 0.15,
  convergenceThreshold: evolvedConfig?.convergenceThreshold || 0.8,
  maxIterations: evolvedConfig?.maxIterations || 20,
};

const orchestrator = new SwarmOrchestratorPi({
  config: finalConfig,
  task,
  provider: 'anthropic',
});
```

### 使用预定义兵种

```typescript
import { recommendBioform, getBioform, BIOFORMS } from '@tyranids/swarm-core';

// 根据任务类型推荐兵种
const bioform = recommendBioform('add-feature'); // 返回 Explorer

// 使用兵种配置
const config: SwarmConfig = {
  agentCount: bioform.traits.agentCount || 5,
  explorationRate: bioform.traits.explorationRate,
  convergenceThreshold: 0.8,
  maxIterations: bioform.traits.maxIterations || 20,
};

// 获取特定兵种
const carnifex = getBioform('carnifex');

// 访问所有兵种
console.log(BIOFORMS.explorer);
console.log(BIOFORMS.refiner);
console.log(BIOFORMS.carnifex);
```

## 数据存储

### 目录结构

```
~/.tyranids/gene-pool/
├── execution-history.jsonl    # 执行历史（JSONL 格式）
└── evolved-configs.json        # 进化后的配置
```

### execution-history.jsonl

每行一个 JSON 对象，记录一次执行：

```jsonl
{"id":"exec-1234567890","timestamp":1234567890,"taskType":"add-feature","task":{...},"config":{...},"results":{...},"score":0.85}
{"id":"exec-1234567891","timestamp":1234567891,"taskType":"refactor","task":{...},"config":{...},"results":{...},"score":0.92}
```

### evolved-configs.json

按任务类型存储进化后的最佳配置：

```json
{
  "add-feature": {
    "agentCount": 6,
    "explorationRate": 0.22,
    "convergenceThreshold": 0.75,
    "maxIterations": 18
  },
  "refactor": {
    "agentCount": 5,
    "explorationRate": 0.08,
    "convergenceThreshold": 0.88,
    "maxIterations": 25
  }
}
```

## 进化示例流程

```bash
# 第1次执行
npm run test-swarm
→ 使用默认配置: 5 agents, 0.15 探索率
→ 结果: 收敛8轮, 质量0.92, 成本$0.09
→ 🧬 执行记录已保存 (任务类型: add-feature, 评分: 0.85)

# 第2-9次执行
# ... 持续积累数据 ...

# 第10次执行后自动触发进化
→ 🧬 达到 10 次执行,触发自动进化...
→ 🧬 触发虫群技能进化...
→ ✅ add-feature 类任务配置已进化
→    - Agent 数量: 6
→    - 探索率: 0.22
→    - 收敛阈值: 0.75
→ ✅ 进化完成

# 第11次执行
→ 自动使用进化后的配置
→ 🧬 使用进化后的配置: { agentCount: 6, explorationRate: 0.22, ... }
→ 结果: 收敛5轮, 质量0.97, 成本$0.08
```

## 命令行工具

### 查看兵种

```bash
npm run demo-bioengine
```

输出：

```
🧬 泰伦生物引擎演示

=== 预定义兵种 ===

**Explorer** - 探索者 - 快速探索多种实现路径
  探索率: 0.4
  质量阈值: 0.6
  Agent 数量: 3
  速度: fast
  成本: low
  适用场景: 新功能开发, 需要创新方案, 探索性任务

**Refiner** - 精炼者 - 优化已有方案，追求完美
  探索率: 0.05
  质量阈值: 0.95
  Agent 数量: 5
  速度: slow
  成本: medium
  适用场景: 代码重构, 性能优化, 质量提升

...

=== 任务类型推荐 ===

add-feature → Explorer (探索率: 0.4)
refactor → Refiner (探索率: 0.05)
bugfix → Validator (探索率: 0.1)
optimize → Refiner (探索率: 0.05)

=== 执行统计 ===

总执行次数: 12
平均评分: 0.87
最高评分: 0.95

按任务类型分布:
  - add-feature: 8 次
  - refactor: 3 次
  - bugfix: 1 次
```

### 分析进化机会

```typescript
const analysis = await bioEngine.analyzeEvolutionOpportunities();
console.log(analysis);
```

输出：

```markdown
# 虫群技能进化分析

## add-feature 类任务

**最佳配置** (评分: 0.92):
- Agent 数量: 6
- 探索率: 0.22
- 收敛轮次: 5
- 成本: $0.0780

**对比最差配置** (评分: 0.65):
- 改进幅度: 27%

## refactor 类任务

**最佳配置** (评分: 0.95):
- Agent 数量: 5
- 探索率: 0.08
- 收敛轮次: 12
- 成本: $0.1200

**对比最差配置** (评分: 0.78):
- 改进幅度: 17%

## 进化建议

- **add-feature**: 存在明显优化空间，建议应用最佳配置（可提升 27%）
- **refactor**: 存在明显优化空间，建议应用最佳配置（可提升 17%）
```

## 主宰意志 (Hive Mind)

所有虫子共享通过基因库和信息素池连接的集体意识：

```
                 ┌─────────────────┐
                 │   Gene Pool     │ (持久化基因)
                 │  (基因库)        │
                 └────────┬────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    [Explorer 1]    [Refiner 1]    [Validator 1]
    [Explorer 2]    [Refiner 2]    [Validator 2]
          │               │               │
          └───────────────┼───────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Pheromone Pool  │ (实时信息素)
                 │  (信息素池)      │
                 └─────────────────┘
```

- **基因库**: 长期记忆，跨项目共享，持久化存储
- **信息素池**: 短期记忆，当前任务共享，内存存储

## 未来扩展

### 环境适应 (Planetary Assimilation)

分析代码库"生态环境"：

- 语言生态（TypeScript, Python, etc.）
- 架构模式（MVC, Hexagonal, etc.）
- 测试覆盖度
- 代码复杂度
- 依赖生态

根据环境自动调整兵种配置。

### 代码模式提取

从成功方案中提取可复用的代码模式：

- AST 模式识别
- 高频模式统计
- 模式成功率跟踪

### 动态兵种生成

基于基因库和环境分析，动态生成专门化兵种：

```typescript
const customBioform = await evolveBioform(task, environment, genePool);
```

## 总结

泰伦生物引擎为 Tyranids 虫群系统带来：

1. **自我进化**: 从执行中学习，持续优化
2. **兵种多样化**: 6 种预定义兵种，针对不同任务
3. **遗传算法**: 科学优化配置参数
4. **零配置**: 自动记录、自动进化、自动应用
5. **战锤40k 风格**: 基因吞噬、主宰意志、生物适应

像真正的泰伦虫族一样，虫群会从每次"战斗"（任务执行）中吞噬"基因"（成功模式），快速进化出适应当前"行星"（代码库）的"兵种"（Agent 配置）。

🧬 **For the Hive Mind!**
