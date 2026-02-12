/**
 * 预定义兵种 - 泰伦虫族的专门化单位
 *
 * 灵感来自战锤40k泰伦虫族的不同生物形态
 */

import type { Bioform } from './types.js';

/**
 * 预定义的虫群兵种
 *
 * 每种兵种针对特定任务类型优化
 */
export const BIOFORMS: { [key: string]: Bioform } = {
  /**
   * Explorer (探索者) - 快速探索多种实现路径
   *
   * 类比泰伦的 Genestealer（基因窃取者）
   * 高探索率，低质量阈值，追求多样性
   */
  explorer: {
    name: 'Explorer',
    role: '探索者 - 快速探索多种实现路径',
    traits: {
      explorationRate: 0.40,
      qualityThreshold: 0.60,
      speed: 'fast',
      cost: 'low',
      agentCount: 3,
      maxIterations: 15,
    },
    适用场景: ['新功能开发', '需要创新方案', '探索性任务'],
  },

  /**
   * Refiner (精炼者) - 优化已有方案，追求完美
   *
   * 类比泰伦的 Tyranid Warrior（泰伦战士）
   * 低探索率，高质量阈值，精益求精
   */
  refiner: {
    name: 'Refiner',
    role: '精炼者 - 优化已有方案，追求完美',
    traits: {
      explorationRate: 0.05,
      qualityThreshold: 0.95,
      speed: 'slow',
      cost: 'medium',
      agentCount: 5,
      maxIterations: 30,
    },
    适用场景: ['代码重构', '性能优化', '质量提升'],
  },

  /**
   * Validator (验证者) - 测试和验证方案可靠性
   *
   * 类比泰伦的 Gargoyle（石像鬼）
   * 中等探索率，高质量阈值，专注验证
   */
  validator: {
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
    适用场景: ['Bug修复', '测试验证', '安全审查'],
  },

  /**
   * Carnifex (重型突击兵) - 处理复杂、大规模的代码任务
   *
   * 类比泰伦的 Carnifex（屠杀者）
   * 大规模并行，高资源消耗，适合复杂任务
   */
  carnifex: {
    name: 'Carnifex',
    role: '重型突击兵 - 处理复杂、大规模的代码任务',
    traits: {
      explorationRate: 0.20,
      qualityThreshold: 0.85,
      speed: 'normal',
      cost: 'high',
      agentCount: 15,
      maxIterations: 25,
    },
    适用场景: ['大规模重构', '整个模块重写', '复杂系统设计'],
  },

  /**
   * Lictor (刺客) - 快速、精准的小型修改
   *
   * 类比泰伦的 Lictor（猎杀者）
   * 单 Agent，极速执行，最小成本
   */
  lictor: {
    name: 'Lictor',
    role: '刺客 - 快速、精准的小型修改',
    traits: {
      explorationRate: 0.05,
      qualityThreshold: 0.80,
      speed: 'extreme',
      cost: 'low',
      agentCount: 1,
      maxIterations: 10,
    },
    适用场景: ['简单bug修复', '小型改动', '快速迭代'],
  },

  /**
   * Hive Tyrant (主宰暴君) - 统筹全局的强大兵种
   *
   * 类比泰伦的 Hive Tyrant（主宰暴君）
   * 平衡各项指标，适合一般性任务
   */
  hiveTyrant: {
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
    适用场景: ['一般性任务', '未知任务类型', '平衡方案'],
  },
};

/**
 * 根据任务类型推荐兵种
 */
export function recommendBioform(taskType: string): Bioform {
  switch (taskType) {
    case 'add-feature':
      return BIOFORMS.explorer;
    case 'refactor':
      return BIOFORMS.refiner;
    case 'bugfix':
      return BIOFORMS.validator;
    case 'optimize':
      return BIOFORMS.refiner;
    default:
      return BIOFORMS.hiveTyrant;
  }
}

/**
 * 获取兵种配置
 */
export function getBioform(name: string): Bioform | undefined {
  return BIOFORMS[name.toLowerCase()];
}

/**
 * 列出所有可用兵种
 */
export function listBioforms(): Bioform[] {
  return Object.values(BIOFORMS);
}
