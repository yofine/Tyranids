/**
 * SubSwarmOrchestrator - Orchestrates a single phase with multiple agents
 *
 * Used by MetaOrchestrator to execute individual task phases
 */

import type {
  TaskPhase,
  PhaseContext,
  PhaseResult,
  CodingTask,
} from './types.js';
import { SwarmAgentPi } from './swarm-agent-pi.js';
import { PheromonePool } from './pheromone-pool.js';

export interface SubSwarmConfig {
  /** Phase definition */
  phase: TaskPhase;
  /** Context from previous phases */
  context: PhaseContext;
  /** LLM provider */
  provider?: string;
  /** Model name */
  modelName?: string;
}

export class SubSwarmOrchestrator {
  private phase: TaskPhase;
  private context: PhaseContext;
  private agents: SwarmAgentPi[] = [];
  private pheromonePool: PheromonePool;
  private provider: string;
  private modelName: string;

  constructor(config: SubSwarmConfig) {
    this.phase = config.phase;
    this.context = config.context;
    this.provider = config.provider || 'anthropic';
    this.modelName = config.modelName || 'claude-haiku-4-5-20241022';
    this.pheromonePool = new PheromonePool();
  }

  /**
   * Execute this phase with a dedicated swarm
   */
  async execute(): Promise<PhaseResult> {
    const startTime = Date.now();

    console.log(`\n🐝 [Phase: ${this.phase.name}] 启动子虫群...`);
    console.log(`   目标: ${this.phase.objective}`);
    console.log(`   文件: ${this.phase.assignedFiles.join(', ')}`);
    console.log(`   规模: ${this.phase.agentCount} agents × ${this.phase.maxIterations} iterations`);

    // Build task prompt with context
    const taskPrompt = this.buildTaskPrompt();

    // Create agents
    for (let i = 0; i < this.phase.agentCount; i++) {
      const task: CodingTask = {
        description: taskPrompt,
        filePath: this.phase.assignedFiles[0], // Primary file
        baseCode: this.context.completedFiles[this.phase.assignedFiles[0]] || '',
        type: 'add-feature',
      };

      this.agents.push(
        new SwarmAgentPi({
          id: `${this.phase.name}-agent-${i}`,
          pheromonePool: this.pheromonePool,
          task,
          provider: this.provider,
          modelName: this.modelName,
        })
      );
    }

    // Execute all agents in parallel
    await Promise.all(
      this.agents.map(agent => agent.execute(this.phase.maxIterations))
    );

    const duration = Date.now() - startTime;

    // Extract best solution
    const topSolutions = this.pheromonePool.getTop(3);
    const best = topSolutions[0];

    if (!best) {
      throw new Error(`Phase ${this.phase.name} failed: no solutions generated`);
    }

    console.log(`   ✅ Phase 完成: 质量 ${best.quality.toFixed(2)}, 耗时 ${(duration / 1000).toFixed(1)}s`);
    console.log(`   📊 探索了 ${this.pheromonePool.size()} 个方案\n`);

    // Parse generated files
    const generatedFiles = this.parseGeneratedFiles(best.codeFragment.content);

    // Extract exported interfaces
    const exportedInterfaces = this.extractInterfaces(best.codeFragment.content);

    return {
      phaseName: this.phase.name,
      files: generatedFiles,
      exportedInterfaces,
      quality: best.quality,
      duration,
      solutionsExplored: this.pheromonePool.size(),
    };
  }

  /**
   * Build task prompt with context from previous phases
   */
  private buildTaskPrompt(): string {
    let prompt = `# Phase: ${this.phase.name}\n\n`;
    prompt += `## Objective\n${this.phase.objective}\n\n`;

    // Add completed files from previous phases
    const completedFilesList = Object.keys(this.context.completedFiles);
    if (completedFilesList.length > 0) {
      prompt += `## Context: Files Already Completed\n\n`;
      prompt += `The following files have been completed by previous phases. You MUST import from these files and follow their interfaces:\n\n`;

      for (const [path, content] of Object.entries(this.context.completedFiles)) {
        // Only show first 30 lines to avoid prompt bloat
        const lines = content.split('\n').slice(0, 30);
        const truncated = lines.length < content.split('\n').length;

        prompt += `### ${path}\n\`\`\`typescript\n${lines.join('\n')}${truncated ? '\n// ... (truncated)' : ''}\n\`\`\`\n\n`;
      }
    }

    // Add interface constraints
    const interfaceNames = Object.keys(this.context.interfaces);
    if (interfaceNames.length > 0) {
      prompt += `## Required Interfaces\n\n`;
      prompt += `You MUST use these exact interface definitions:\n\n`;

      for (const [, definition] of Object.entries(this.context.interfaces)) {
        prompt += `\`\`\`typescript\n${definition}\n\`\`\`\n\n`;
      }
    }

    // Task requirements
    prompt += `## Your Task\n\n`;
    prompt += `Generate the following file(s): **${this.phase.assignedFiles.join(', ')}**\n\n`;

    prompt += `Requirements:\n`;
    prompt += `- If previous files exist, import from them using correct relative paths (e.g., import { Token } from './tokenizer.js')\n`;
    prompt += `- Follow the interfaces defined above exactly\n`;
    prompt += `- Ensure type safety and compilation success\n`;
    prompt += `- Keep code clean and simple\n\n`;

    if (this.phase.assignedFiles.length > 1) {
      prompt += `Return multiple files in this format:\n`;
      prompt += `\`\`\`typescript:${this.phase.assignedFiles[0]}\n// code here\n\`\`\`\n\n`;
      prompt += `\`\`\`typescript:${this.phase.assignedFiles[1]}\n// code here\n\`\`\`\n`;
    } else {
      prompt += `Return ONLY the TypeScript code for ${this.phase.assignedFiles[0]}, no explanations.\n`;
    }

    return prompt;
  }

  /**
   * Parse generated files from code fragment
   */
  private parseGeneratedFiles(content: string): { [filePath: string]: string } {
    const files: { [filePath: string]: string } = {};

    // Try to extract with filename markers
    const regex = /```(?:typescript|ts):([^\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const filePath = match[1].trim();
      const code = match[2].trim();
      files[filePath] = code;
    }

    // Fallback: single file without marker
    if (Object.keys(files).length === 0 && this.phase.assignedFiles.length === 1) {
      const singleFileRegex = /```(?:typescript|ts)\n([\s\S]*?)```/;
      const singleMatch = content.match(singleFileRegex);

      if (singleMatch) {
        files[this.phase.assignedFiles[0]] = singleMatch[1].trim();
      }
    }

    return files;
  }

  /**
   * Extract exported interfaces from code
   */
  private extractInterfaces(code: string): { [name: string]: string } {
    const interfaces: { [name: string]: string } = {};

    // Match: export interface Name { ... }
    const interfaceRegex = /export\s+interface\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = interfaceRegex.exec(code)) !== null) {
      const name = match[1];
      const body = match[2];
      interfaces[name] = `export interface ${name} {${body}}`;
    }

    // Match: export type Name = ...
    const typeRegex = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
    while ((match = typeRegex.exec(code)) !== null) {
      const name = match[1];
      const definition = match[2];
      interfaces[name] = `export type ${name} = ${definition};`;
    }

    // Match: export enum Name { ... }
    const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = enumRegex.exec(code)) !== null) {
      const name = match[1];
      const body = match[2];
      interfaces[name] = `export enum ${name} {${body}}`;
    }

    return interfaces;
  }

  /**
   * Get pheromone pool for inspection
   */
  getPheromonePool(): PheromonePool {
    return this.pheromonePool;
  }
}
