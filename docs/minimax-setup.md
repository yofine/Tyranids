# Minimax 模型配置指南

本指南说明如何使用 Minimax 模型运行 Tyranids 虫群系统。

## Minimax 简介

Minimax 是一个中国的 LLM 提供商,提供高性价比的大语言模型服务。

## 前置要求

1. Minimax API Key
2. Minimax Group ID

获取方式: 访问 [Minimax 官网](https://api.minimax.chat/) 注册并创建应用

## 配置环境变量

```bash
# 设置 Minimax API Key
export MINIMAX_API_KEY="your-minimax-api-key"

# 设置 Minimax Group ID
export MINIMAX_GROUP_ID="your-group-id"
```

或者在 `.env` 文件中配置:

```env
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_GROUP_ID=your-group-id
```

## Pi 框架支持

Tyranids 基于 Pi 框架 (@mariozechner/pi-ai),该框架原生支持 Minimax。

### 检查 Pi 框架版本

```bash
npm list @mariozechner/pi-ai
```

确保版本 >= 0.1.0 (支持 Minimax)

## 使用 Minimax 运行虫群

### 方法 1: 修改示例代码

编辑 `examples/add-priority-feature/run-swarm.ts`:

```typescript
const orchestrator = new SwarmOrchestratorPi({
  config,
  task,
  provider: 'minimax',  // 改为 'minimax'
});
```

### 方法 2: 创建自定义脚本

创建 `run-swarm-minimax.ts`:

```typescript
import { SwarmOrchestratorPi } from '@tyranids/swarm-core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  console.log('🐝 Tyranids 虫群系统 - Minimax 版本\n');

  // 读取原始代码
  const baseCode = await readFile(join(__dirname, 'todo.ts'), 'utf-8');

  // 定义任务
  const task = {
    description: `为 Todo 接口添加优先级(priority)功能。

要求:
1. 在 Todo 接口中添加 priority 字段
2. 修改 addTodo 函数支持设置优先级
3. 实现 sortByPriority 函数按优先级排序
4. 保持类型安全,确保 TypeScript 编译通过`,
    filePath: join(__dirname, 'todo.ts'),
    baseCode,
    type: 'add-feature' as const,
  };

  // 虫群配置
  const config = {
    agentCount: 5,
    maxIterations: 20,
    convergenceThreshold: 0.8,
    explorationRate: 0.15,
    modelPreference: 'haiku-only' as const,  // Minimax 会使用对应的小模型
  };

  // 创建编排器 - 使用 Minimax
  const orchestrator = new SwarmOrchestratorPi({
    config,
    task,
    provider: 'minimax',  // 关键: 设置为 'minimax'
  });

  console.log('配置:');
  console.log(`- Agent 数量: ${config.agentCount}`);
  console.log(`- 最大迭代: ${config.maxIterations}`);
  console.log(`- 收敛阈值: ${config.convergenceThreshold * 100}%`);
  console.log(`- LLM 提供商: Minimax\n`);

  // 执行虫群
  const startTime = Date.now();
  const topSolutions = await orchestrator.execute();
  const duration = (Date.now() - startTime) / 1000;

  // 保存结果
  console.log('\n💾 保存结果...\n');

  for (let i = 0; i < Math.min(3, topSolutions.length); i++) {
    const solution = topSolutions[i];
    const filename = `generated-solution-minimax-${i + 1}.ts`;
    const filepath = join(__dirname, 'generated', filename);

    await writeFile(filepath, solution.codeFragment.content);

    console.log(`✅ 方案 ${i + 1} 已保存: ${filename}`);
    console.log(`   质量: ${solution.quality.toFixed(2)}`);
    console.log(`   支持: ${solution.depositors.length} agents`);
    console.log('');
  }

  // 导出度量数据
  const metricsPath = join(__dirname, 'generated', 'swarm-metrics-minimax.json');
  await writeFile(metricsPath, orchestrator.observer.exportJSON());

  console.log(`📊 度量数据已保存: swarm-metrics-minimax.json\n`);

  // 总结
  console.log('📈 执行总结:');
  console.log(`- 总耗时: ${duration.toFixed(2)}s`);
  console.log(`- 发现方案: ${orchestrator.getPheromonePool().size()} 个`);
  console.log(`- Top-3 质量: [${topSolutions.slice(0, 3).map(s => s.quality.toFixed(2)).join(', ')}]`);

  const metrics = orchestrator.observer.getMetrics();
  console.log(`- LLM 调用: ${metrics.llmCalls.total} 次`);
  console.log(`- 估算成本: ¥${metrics.llmCalls.estimatedCost.toFixed(4)}`);  // Minimax 使用人民币计价
  console.log(`- 收敛轮次: ${metrics.convergenceIteration}`);
}

main().catch(console.error);
```

### 编译并运行

```bash
# 添加到 package.json scripts
{
  "scripts": {
    "test-swarm-minimax": "npm run build && node dist/run-swarm-minimax.js"
  }
}

# 运行
npm run test-swarm-minimax
```

## Minimax 模型选择

Pi 框架会根据 `modelPreference` 自动选择 Minimax 模型:

```typescript
const config = {
  modelPreference: 'haiku-only',     // 使用 Minimax 小模型 (成本低)
  // modelPreference: 'sonnet-preferred',  // 使用 Minimax 大模型 (质量高)
};
```

具体映射由 Pi 框架处理,你无需手动指定模型名称。

## 成本估算

Minimax 的定价通常比 Anthropic Claude 更低:

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| Minimax 小模型 | ~¥0.001/1K tokens | ~¥0.002/1K tokens |
| Minimax 大模型 | ~¥0.01/1K tokens | ~¥0.02/1K tokens |

**典型虫群执行成本** (5 agents, 20 iterations):
- 输入 tokens: ~8,000
- 输出 tokens: ~12,000
- **估算成本**: ¥0.03 - ¥0.10 (取决于模型选择)

## 性能对比

运行相同任务,对比 Minimax 和 Anthropic 的表现:

```bash
# 运行 Anthropic 版本
export ANTHROPIC_API_KEY="..."
npm run test-swarm

# 运行 Minimax 版本
export MINIMAX_API_KEY="..."
export MINIMAX_GROUP_ID="..."
npm run test-swarm-minimax

# 对比度量数据
diff generated/swarm-metrics.json generated/swarm-metrics-minimax.json
```

## 常见问题

### Q: Minimax API 调用失败

**A**: 检查环境变量是否正确设置:

```bash
echo $MINIMAX_API_KEY
echo $MINIMAX_GROUP_ID
```

确保两个变量都已设置。

### Q: Pi 框架不支持 Minimax

**A**: 检查 Pi 框架版本:

```bash
npm list @mariozechner/pi-ai
```

如果版本过低,更新到最新版本:

```bash
npm update @mariozechner/pi-ai
```

### Q: 如何查看实际使用的模型?

**A**: Pi 框架会在调用时输出日志,查看控制台输出。

或者查看 Pi 框架源码中的模型映射:
```bash
cat node_modules/@mariozechner/pi-ai/dist/index.d.ts | grep -A 10 "minimax"
```

### Q: Minimax 和 Anthropic 哪个更好?

**A**: 取决于你的需求:

| 维度 | Anthropic Claude | Minimax |
|------|-----------------|---------|
| **成本** | 较高 ($) | ✅ 较低 (¥) |
| **质量** | ✅ 优秀 | 良好 |
| **速度** | 快 | ✅ 很快 |
| **中文支持** | 良好 | ✅ 优秀 |

建议:
- **原型验证**: 使用 Minimax (成本低)
- **生产环境**: 使用 Anthropic (质量高)
- **中文任务**: 优先 Minimax

## 生物引擎与 Minimax

生物引擎同样支持 Minimax:

```typescript
const bioEngine = new TyranidBioEngine();

// 执行会自动记录,无论使用哪个提供商
await orchestrator.execute();  // provider: 'minimax'

// 查看统计
const stats = await bioEngine.getStatistics();
console.log('使用 Minimax 的执行次数:', stats.totalExecutions);
```

进化后的配置对所有提供商通用:

```typescript
// 加载进化后的配置
const evolvedConfig = await SwarmOrchestratorPi.loadEvolvedConfig('add-feature');

// 使用 Minimax 运行
const orchestrator = new SwarmOrchestratorPi({
  config: evolvedConfig,  // 进化后的配置
  task,
  provider: 'minimax',    // 切换到 Minimax
});
```

## 最佳实践

### 1. 成本优化

```typescript
const config = {
  agentCount: 3,              // 减少 agents
  maxIterations: 15,          // 减少迭代
  convergenceThreshold: 0.7,  // 降低收敛阈值
  modelPreference: 'haiku-only',
};
```

### 2. 中文任务

对于中文代码和注释,Minimax 表现更好:

```typescript
const task = {
  description: `为用户类添加角色权限字段。

要求:
1. 添加 role 字段,类型为 'admin' | 'user' | 'guest'
2. 添加 hasPermission 方法检查权限
3. 保持类型安全`,
  filePath: './user.ts',
  baseCode,
  type: 'add-feature' as const,
};
```

### 3. 批量测试

使用 Minimax 进行批量测试,积累进化数据:

```bash
# 运行 10 次测试
for i in {1..10}; do
  npm run test-swarm-minimax
  sleep 5
done

# 查看进化结果
npm run demo-bioengine
```

## 下一步

- 尝试不同的任务类型验证 Minimax 表现
- 对比 Minimax 和 Anthropic 的成本/质量
- 使用 Minimax 积累基因库数据
- 分析进化后的配置在 Minimax 上的表现

## 参考资料

- [Minimax API 文档](https://api.minimax.chat/document)
- [Pi 框架文档](./pi-framework-api.md)
- [快速上手指南](./quick-start.md)
