/**
 * EnvironmentAgent - Autonomous agent using Pi Agent framework
 *
 * Each iteration = one agent.prompt() call that runs the full tool-calling loop.
 * The Pi Agent framework (pi-agent-core) handles:
 * - Tool dispatch (via AgentTool.execute())
 * - Multi-turn conversation management
 * - Streaming and cancellation (AbortSignal)
 *
 * Synaptic memory is injected at the start of each iteration so the agent
 * can learn from its own past attempts. Context is fresh per iteration,
 * but the markdown-based memory persists across iterations (and crashes).
 *
 * The agent perceives the environment through tools, decides which file
 * to work on, reads dependencies, generates content, and submits solutions.
 * No central coordinator tells it what to do.
 */

import { Agent, type AgentEvent, type AgentTool } from '@mariozechner/pi-agent-core';
import type { Message, Model, Api } from '@mariozechner/pi-ai';
import type { SwarmEnvironment } from './environment.js';
import type { CompileFunction } from './types.js';
import { createSwarmTools } from './swarm-tools.js';
import type { SynapticMemory } from './synaptic-memory.js';

export interface EnvironmentAgentConfig {
  id: string;
  environment: SwarmEnvironment;
  compileFn: CompileFunction;
  model: Model<Api>;
  maxIterations: number;
  memory?: SynapticMemory;
  /** Optional custom system prompt override. If not set, uses the default autonomous agent prompt. */
  systemPrompt?: string;
}

function buildDefaultSystemPrompt(): string {
  return `You are an autonomous swarm agent in a decentralized multi-agent system.
You work on ONE file/artifact at a time. No central coordinator tells you what to do.

Your workflow:
1. Call perceive_environment to see all files, their status, and recommendations
2. Choose the file that needs the most help, using the "recommendation" field:
   - HIGHEST: "empty" files whose dependencies are satisfied AND activeAgentCount is 0
   - HIGH: "blocked" files with interface_mismatch signals you can fix
   - MEDIUM: "attempted" or "partial" files with low activeAgentCount
   - LOW: "solid" files (only if nothing else needs work)
   - SKIP: "excellent" files, or any file with activeAgentCount >= 2
3. If the file depends on other files, call read_file_solution for each dependency
4. Write a complete solution for the file, respecting the language and conventions used
5. Call compile_check to verify your solution validates in context
6. If validation fails, read errors, fix your solution, compile_check again (up to 3 attempts)
7. Call submit_solution with your final content, declaring all exports and imports

Memory & Stigmergy:
- Your synaptic memory (past iterations) may be included in the message below.
  Use it to avoid repeating failed approaches and build on past successes.
- Use read_trail_markers to see what OTHER agents tried on a file before you work on it.
- Use leave_trail_marker to warn about pitfalls or share discoveries for other agents.
- Trail markers are stigmergy: you communicate by modifying the shared environment,
  not by talking directly to other agents.

Rules:
- Always perceive the environment first
- Always read dependency solutions before writing content that references them
- Check the activeAgentCount field — avoid files where 2+ agents are already working
- Always compile_check before submitting
- Declare ALL exported names accurately
- Declare ALL imports with the correct from_file path
- Write complete, working solutions — not stubs or placeholders
- Each file must properly declare its dependencies and exports`;
}

export class EnvironmentAgent {
  private id: string;
  private environment: SwarmEnvironment;
  private model: Model<Api>;
  private maxIterations: number;
  private agentTools: AgentTool[];
  private memory: SynapticMemory | null;
  private systemPrompt: string;
  private piAgent: Agent;
  private shouldStop: boolean = false;
  private iterationsCompleted: number = 0;
  private successfulSubmits: number = 0;

  // Tracked per-iteration via event subscription
  private lastTargetFile: string = '';
  private lastQuality: number | null = null;
  private lastCompilationSuccess: boolean | null = null;
  private lastCompilationErrors: string[] = [];
  private lastAction: 'explore' | 'submit' | 'compile_check' = 'explore';
  // Track tool args from start events (tool_execution_end doesn't include args)
  private pendingToolArgs: Map<string, Record<string, unknown>> = new Map();

  constructor(config: EnvironmentAgentConfig) {
    this.id = config.id;
    this.environment = config.environment;
    this.model = config.model;
    this.maxIterations = config.maxIterations;
    this.memory = config.memory ?? null;
    this.systemPrompt = config.systemPrompt ?? buildDefaultSystemPrompt();

    const { agentTools } = createSwarmTools(
      config.environment,
      config.compileFn,
      config.id,
      config.memory
    );
    this.agentTools = agentTools;

    // Create the Pi Agent instance
    this.piAgent = new Agent({
      initialState: {
        systemPrompt: this.systemPrompt,
        model: this.model,
        tools: this.agentTools,
      },
      convertToLlm: (messages) =>
        messages.filter(
          (m): m is Message =>
            m.role === 'user' || m.role === 'assistant' || m.role === 'toolResult'
        ),
    });

    // Subscribe to events for tracking metrics
    this.piAgent.subscribe((event: AgentEvent) => {
      this.handleAgentEvent(event);
    });
  }

  /**
   * Execute all iterations
   */
  async execute(): Promise<void> {
    console.log(`[${this.id}] Starting execution (max ${this.maxIterations} iterations)`);

    for (let i = 0; i < this.maxIterations; i++) {
      if (this.shouldStop) {
        console.log(`[${this.id}] Stopped at iteration ${i}`);
        break;
      }

      // Check if environment has converged
      if (this.environment.hasConverged()) {
        console.log(`[${this.id}] Environment converged, stopping at iteration ${i}`);
        break;
      }

      try {
        await this.executeIteration(i + 1);
        this.iterationsCompleted = i + 1;
      } catch (error: any) {
        console.error(`[${this.id}] Error in iteration ${i + 1}: ${error.message}`);
      }
    }

    console.log(
      `[${this.id}] Completed (${this.iterationsCompleted} iterations, ` +
      `${this.successfulSubmits} successful submits)`
    );
  }

  /**
   * Execute a single iteration: one agent.prompt() call with automatic tool execution
   */
  private async executeIteration(iterationNum: number): Promise<void> {
    // Reset per-iteration tracking
    this.lastTargetFile = '';
    this.lastQuality = null;
    this.lastCompilationSuccess = null;
    this.lastCompilationErrors = [];
    this.lastAction = 'explore';

    // 1. Read synaptic memory (agent's own past iterations)
    let memoryBlock = '';
    if (this.memory) {
      memoryBlock = await this.memory.readSynapticMemory(this.id);
    }

    // 2. Build user message with memory injected
    let userContent = `Iteration ${iterationNum}/${this.maxIterations}. You are agent "${this.id}". Use your tools to contribute to the project. Start by perceiving the environment.`;

    if (memoryBlock) {
      userContent += `\n\n--- SYNAPTIC MEMORY (your past iterations) ---\n${memoryBlock}\n--- END MEMORY ---\n\nUse this memory to avoid repeating failed approaches. You can also use read_trail_markers to see what other agents tried.`;
    }

    // 3. Clear previous messages and run the agent loop
    this.piAgent.clearMessages();
    await this.piAgent.prompt(userContent);

    // 4. Record this iteration to synaptic memory
    if (this.memory && this.lastTargetFile) {
      // Extract a brief approach description from the agent's final text
      const messages = this.piAgent.state.messages;
      const lastMsg = messages[messages.length - 1];
      let textParts = '';
      if (lastMsg && lastMsg.role === 'assistant' && 'content' in lastMsg) {
        const content = lastMsg.content as Array<{ type: string; text?: string }>;
        textParts = content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text!)
          .join('');
      }

      const approach = textParts.length > 100
        ? textParts.substring(0, 100) + '...'
        : textParts || 'No text summary';

      let outcome = 'no submission';
      if (this.lastQuality !== null) {
        outcome = `quality=${Number(this.lastQuality).toFixed(2)}, ${this.lastCompilationSuccess ? 'compiled' : 'compilation failed'}`;
      }

      this.memory.appendSynapticEntry(this.id, {
        iteration: iterationNum,
        timestamp: Date.now(),
        targetFile: this.lastTargetFile,
        action: this.lastAction,
        quality: this.lastQuality,
        compilationSuccess: this.lastCompilationSuccess,
        compilationErrors: this.lastCompilationErrors.slice(0, 3),
        approach,
        outcome,
      });
    }

    // 5. Log iteration summary
    const messages = this.piAgent.state.messages;
    const lastMsg = messages[messages.length - 1];
    let textContent = '';
    if (lastMsg && lastMsg.role === 'assistant' && 'content' in lastMsg) {
      const content = lastMsg.content as Array<{ type: string; text?: string }>;
      textContent = content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('');
    }

    if (textContent) {
      const summary = textContent.length > 200
        ? textContent.substring(0, 200) + '...'
        : textContent;
      console.log(`[${this.id}] Iteration ${iterationNum}: ${summary.replace(/\n/g, ' ')}`);
    } else {
      console.log(`[${this.id}] Iteration ${iterationNum}: completed`);
    }
  }

  /**
   * Handle events from the Pi Agent framework to track metrics
   */
  private handleAgentEvent(event: AgentEvent): void {
    // Track tool args from start events (end events don't include args)
    if (event.type === 'tool_execution_start') {
      this.pendingToolArgs.set(event.toolCallId, event.args as Record<string, unknown>);
      return;
    }

    if (event.type === 'tool_execution_end') {
      const { toolCallId, toolName, result, isError } = event;
      const args = this.pendingToolArgs.get(toolCallId) ?? {};
      this.pendingToolArgs.delete(toolCallId);

      if (isError) return;

      if (toolName === 'submit_solution' || toolName === 'compile_check') {
        try {
          const resultContent = result as { content: Array<{ type: string; text: string }>; details: unknown };
          const textItem = resultContent.content.find((c) => c.type === 'text');
          if (!textItem) return;

          const parsed = JSON.parse(textItem.text);
          const filePath = String(args.file_path ?? '');

          if (toolName === 'submit_solution') {
            this.lastTargetFile = filePath;
            this.lastAction = 'submit';
            this.lastQuality = parsed.quality ?? null;
            this.lastCompilationSuccess = parsed.compilationSuccess ?? null;
            this.lastCompilationErrors = parsed.errors ?? [];
            if (parsed.compilationSuccess || parsed.quality >= 0.5) {
              this.successfulSubmits++;
            }
          } else {
            this.lastTargetFile = filePath;
            this.lastAction = 'compile_check';
            this.lastCompilationSuccess = parsed.success ?? null;
            this.lastCompilationErrors = parsed.errors ?? [];
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Signal the agent to stop
   */
  stop(): void {
    this.shouldStop = true;
    this.piAgent.abort();
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get number of completed iterations
   */
  getIterationsCompleted(): number {
    return this.iterationsCompleted;
  }

  /**
   * Get number of successful solution submits
   */
  getSuccessfulSubmits(): number {
    return this.successfulSubmits;
  }
}
