/**
 * 泰伦生物引擎类型定义
 *
 * 基因吞噬、兵种进化、环境适应的核心数据结构
 */

import type { SwarmConfig, SwarmMetrics, CodingTask } from '../types.js';

/**
 * 代码模式 - 从成功方案中提取的可复用模式
 */
export interface CodePattern {
  pattern: string; // 正则表达式或 AST 模式
  context: string; // 出现的上下文
  successRate: number; // 成功率 0-1
  usageCount: number; // 使用次数
}

/**
 * 基因物质 - 从执行中提取的"基因"
 */
export interface GeneticMaterial {
  id: string;
  timestamp: number;
  source: 'execution' | 'manual' | 'crossover'; // 基因来源

  // 代码基因（成功的代码模式）
  codePatterns: CodePattern[];

  // 行为基因（有效的策略）
  behaviorGenes: {
    explorationRate: number;
    agentCount: number;
    convergenceSpeed: number; // 收敛速度（迭代次数的倒数）
    qualityThreshold: number;
  };

  // 环境适应基因
  environmentTraits: {
    language: string; // TypeScript, Python, etc.
    framework?: string; // React, Vue, etc.
    architectureStyle?: string; // MVC, microservices, etc.
  };

  // 适应度评分
  fitness: number; // 0-1 评分
}

/**
 * 兵种特性
 */
export interface BioformTraits {
  explorationRate: number; // 探索率
  qualityThreshold: number; // 质量阈值
  agentCount?: number; // Agent 数量
  speed?: 'slow' | 'normal' | 'fast' | 'extreme'; // 执行速度
  cost?: 'low' | 'medium' | 'high'; // 成本级别
  maxIterations?: number; // 最大迭代次数
}

/**
 * 兵种定义
 */
export interface Bioform {
  name: string;
  role: string;
  traits: BioformTraits;
  适用场景: string[];
  origin?: string; // 进化来源
}

/**
 * 任务类型
 */
export type TaskType = 'add-feature' | 'refactor' | 'bugfix' | 'optimize' | 'unknown';

/**
 * 执行记录 - 用于进化学习
 */
export interface ExecutionRecord {
  id: string;
  timestamp: number;
  taskType: TaskType;
  task: CodingTask;
  config: SwarmConfig;
  results: SwarmMetrics;
  score: number; // 综合评分 0-1
}

/**
 * 环境分析结果
 */
export interface PlanetaryAnalysis {
  // 语言生态
  languages: {
    name: string;
    prevalence: number; // 代码行数占比
  }[];

  // 架构模式
  architecturePatterns: {
    pattern: string; // "MVC", "Hexagonal", etc.
    confidence: number;
  }[];

  // 测试覆盖度
  testingDensity: {
    framework: string;
    coverage: number;
    testToCodeRatio: number;
  };

  // 代码复杂度
  complexity: {
    avgCyclomaticComplexity: number;
    largestFiles: string[];
    hotspots: string[]; // 高频修改的文件
  };

  // 依赖生态
  dependencies: {
    external: string[]; // npm 包
    internal: string[]; // 内部模块
  };
}

/**
 * 兵种组合
 */
export interface BioformMix {
  type: string; // 兵种类型
  count: number; // 数量
}
