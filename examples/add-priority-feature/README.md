# Todo Priority Feature - Swarm Test Case

这个示例演示 Tyranids 虫群系统如何并行探索不同的实现方案。

## 任务描述

为简单的 Todo 应用添加优先级(priority)功能。

### 原始代码

```typescript
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

function addTodo(title: string): Todo { ... }
function toggleTodo(id: string): void { ... }
```

### 目标

1. 在 `Todo` 接口中添加 `priority` 字段
2. 修改 `addTodo` 函数支持设置优先级
3. 实现 `sortByPriority` 函数按优先级排序
4. 保持 TypeScript 类型安全

### 可能的方案

虫群系统可能探索的不同实现路径:

**方案 1: 字符串字面量类型**
```typescript
type Priority = 'low' | 'medium' | 'high';
interface Todo {
  priority: Priority;
}
```

**方案 2: 数字优先级**
```typescript
interface Todo {
  priority: number; // 1-5
}
```

**方案 3: 枚举类型**
```typescript
enum Priority {
  Low = 1,
  Medium = 2,
  High = 3
}
interface Todo {
  priority: Priority;
}
```

## 运行测试

### 方法 1: 使用测试脚本

```bash
cd examples/add-priority-feature
npm install
npm run test-swarm
```

### 方法 2: 使用 SwarmRuntime API

```typescript
import { SwarmRuntimePi } from '@tyranids/swarm-skills';

const runtime = new SwarmRuntimePi('anthropic');

const swarmId = await runtime.spawn({
  task: '为 Todo 添加优先级功能',
  file: './todo.ts',
  agents: 5,
  iterations: 20
});

// 查询状态
const instance = runtime.getStatus(swarmId);
console.log(instance.status);
```

## 预期行为

### 虫群探索过程

```
[agent-0] EXPLORING: 尝试 priority: 'low' | 'medium' | 'high' (质量: 0.6)
[agent-1] EXPLORING: 尝试 priority: number (1-5) (质量: 0.7)
[agent-2] EXPLORING: 使用 enum Priority (质量: 0.9)
[agent-3] REFINING: 跟随 agent-2 方案,优化类型定义 (质量: 0.95)
[agent-4] REFINING: 添加默认优先级 (质量: 0.92)

[迭代 2]
[agent-0] REFINING: 跟随最强信息素,添加排序函数 (质量: 0.85)
[agent-1] REFINING: 跟随 agent-3 方案 (质量: 0.93)
[agent-2] REFINING: 改进排序算法 (质量: 0.96)
[agent-3] REFINING: 添加优先级验证 (质量: 0.98)
[agent-4] IDLE: 收敛...

[收敛检测] Top-3 信息素质量: [0.98, 0.96, 0.95]
[收敛检测] 4/5 agents 聚集在 enum Priority 方案
[Swarm] 收敛！提取最佳方案...
```

### 收敛特征

- **初期多样性**: 不同 agents 探索不同实现方式
- **信息素强化**: 高质量方案吸引更多 agents
- **自然收敛**: 无需中心调度,agents 自发聚集
- **方案对比**: 返回 Top-3 方案供选择

## 目录结构

```
examples/add-priority-feature/
├── README.md                    # 本文件
├── todo.ts                      # 原始代码
├── run-swarm.ts                 # 测试运行器
├── expected-solutions/          # 预期方案示例
│   ├── solution-enum.ts         # 方案1: 字符串字面量
│   ├── solution-number.ts       # 方案2: 数字优先级
│   └── solution-hybrid.ts       # 方案3: 枚举 + 可选
└── generated/                   # 虫群生成的方案
    ├── generated-solution-1.ts  # Top-1 方案
    ├── generated-solution-2.ts  # Top-2 方案
    ├── generated-solution-3.ts  # Top-3 方案
    └── swarm-metrics.json       # 执行度量数据
```

## 评估标准

虫群系统使用以下标准评估方案质量:

### 1. 编译成功 (40%)

```bash
tsc --noEmit generated-solution-1.ts
```

### 2. 功能完整性 (30%)

- ✅ `Todo` 接口包含 `priority` 字段
- ✅ `addTodo` 函数支持 `priority` 参数
- ✅ 实现 `sortByPriority` 函数

### 3. 代码简洁性 (30%)

- ✅ 行数 < 500
- ✅ 循环复杂度 < 20
- ✅ 类型定义清晰

**综合质量** = 0.4 × 编译成功 + 0.3 × 功能完整 + 0.3 × 代码简洁

## 成本分析

典型执行成本 (5 agents, 20 iterations):

- **LLM 调用**: 40-50 次
- **模型**: Claude Haiku
- **Input tokens**: ~8,000
- **Output tokens**: ~12,000
- **估算成本**: $0.05 - $0.10

对比单次 LLM 调用: 成本增加 5-10x,但获得:
- ✅ 多种方案对比
- ✅ 自动质量验证
- ✅ 详细执行报告

## 虫群度量

执行完成后,`swarm-metrics.json` 包含:

```json
{
  "duration": 45230,
  "agentActions": {
    "agent-0": { "explores": 3, "refines": 5 },
    "agent-1": { "explores": 2, "refines": 6 }
  },
  "pheromoneEvolution": [
    { "iteration": 0, "topQuality": 0.45, "convergence": 0.20 },
    { "iteration": 5, "topQuality": 0.87, "convergence": 0.60 },
    { "iteration": 8, "topQuality": 0.96, "convergence": 0.82 }
  ],
  "llmCalls": {
    "total": 42,
    "estimatedCost": 0.078
  },
  "convergenceIteration": 8
}
```

## 下一步

- 查看生成的方案并选择最佳实现
- 分析虫群度量数据优化配置
- 尝试不同的 `agentCount` 和 `explorationRate`
- 对比原生版本和 Pi 版本的性能

## 相关文档

- [系统架构](../../docs/architecture.md)
- [Pi 框架 API](../../docs/pi-framework-api.md)
- [技术蓝图](../../BLUEPRINT.md)
