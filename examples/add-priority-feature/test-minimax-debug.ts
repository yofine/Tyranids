/**
 * Minimax Debug Test - 单个 Agent，单次迭代
 */

import { SwarmOrchestratorPi } from '@tyranids/swarm-core';
import type { CodingTask, SwarmConfig } from '@tyranids/swarm-core';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🐞 Minimax Debug Test\n');

  if (!process.env.MINIMAX_API_KEY) {
    console.error('❌ 错误: 未设置 MINIMAX_API_KEY');
    process.exit(1);
  }

  const srcDir = join(__dirname, '..');
  const baseCode = await readFile(join(srcDir, 'todo.ts'), 'utf-8');

  const task: CodingTask = {
    description: `为 Todo 接口添加优先级(priority)功能。

要求:
1. 在 Todo 接口中添加 priority 字段
2. 修改 addTodo 函数支持设置优先级
3. 实现 sortByPriority 函数按优先级排序

注意: 只返回完整的修改后的代码,不要解释。`,
    filePath: join(srcDir, 'todo.ts'),
    baseCode,
    type: 'add-feature',
  };

  const config: SwarmConfig = {
    agentCount: 1, // 仅 1 个 agent
    maxIterations: 1, // 仅 1 轮迭代
    convergenceThreshold: 0.8,
    explorationRate: 0.15,
    modelPreference: 'haiku-only',
  };

  console.log('开始测试...\n');

  const orchestrator = new SwarmOrchestratorPi({
    config,
    task,
    provider: 'minimax',
  });

  await orchestrator.execute();

  console.log('\n✅ 测试完成');
}

main().catch(console.error);
