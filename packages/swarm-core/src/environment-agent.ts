/**
 * EnvironmentAgent - Autonomous agent using tool calling
 *
 * Each iteration = one multi-turn LLM conversation with tool calls.
 * Synaptic memory is injected at the start of each iteration so the agent
 * can learn from its own past attempts. Context is still fresh per iteration,
 * but the markdown-based memory persists across iterations (and crashes).
 *
 * The agent perceives the environment through tools, decides which file
 * to work on, reads dependencies, generates code, and submits solutions.
 * No central coordinator tells it what to do.
 */

import {
  complete,
  type Context,
  type Model,
  type Api,
  type Tool,
  type ToolCall,
  type ToolResultMessage,
  type Message,
} from '@mariozechner/pi-ai';
import type { SwarmEnvironment } from './environment.js';
import type { CompileFunction } from './types.js';
import { createSwarmTools, type SwarmToolHandlers } from './swarm-tools.js';
import type { SynapticMemory, SynapticEntry } from './synaptic-memory.js';

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
  private tools: Tool[];
  private handlers: SwarmToolHandlers;
  private memory: SynapticMemory | null;
  private systemPrompt: string;
  private shouldStop: boolean = false;
  private iterationsCompleted: number = 0;
  private successfulSubmits: number = 0;

  constructor(config: EnvironmentAgentConfig) {
    this.id = config.id;
    this.environment = config.environment;
    this.model = config.model;
    this.maxIterations = config.maxIterations;
    this.memory = config.memory ?? null;
    this.systemPrompt = config.systemPrompt ?? buildDefaultSystemPrompt();

    const { tools, handlers } = createSwarmTools(
      config.environment,
      config.compileFn,
      config.id,
      config.memory
    );
    this.tools = tools;
    this.handlers = handlers;
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
   * Execute a single iteration: one fresh multi-turn LLM conversation with tool calls
   */
  private async executeIteration(iterationNum: number): Promise<void> {
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

    const context: Context = {
      systemPrompt: this.systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent,
          timestamp: Date.now(),
        } as Message,
      ],
      tools: this.tools,
    };

    let response = await complete(this.model, context);
    context.messages.push(response);

    let toolCallCount = 0;
    const maxToolCalls = 20; // Safety limit per iteration

    // Track what happened this iteration for memory recording
    let lastTargetFile = '';
    let lastQuality: number | null = null;
    let lastCompilationSuccess: boolean | null = null;
    let lastCompilationErrors: string[] = [];
    let lastAction: SynapticEntry['action'] = 'explore';
    while (response.stopReason === 'toolUse' && toolCallCount < maxToolCalls) {
      // Process all tool calls in this response
      for (const item of response.content) {
        if (item.type === 'toolCall') {
          const toolCall = item as ToolCall;
          const result = await this.executeToolCall(toolCall);
          context.messages.push(result);
          toolCallCount++;

          // Track what happened for memory
          const toolArgs = toolCall.arguments as Record<string, any>;
          if (toolCall.name === 'submit_solution' || toolCall.name === 'compile_check') {
            lastTargetFile = toolArgs?.file_path ?? '';
            lastAction = toolCall.name === 'submit_solution' ? 'submit' : 'compile_check';

            try {
              const parsed = JSON.parse(
                (result.content[0] as { type: 'text'; text: string }).text
              );
              if (toolCall.name === 'submit_solution') {
                lastQuality = parsed.quality ?? null;
                lastCompilationSuccess = parsed.compilationSuccess ?? null;
                lastCompilationErrors = parsed.errors ?? [];
                if (parsed.compilationSuccess || parsed.quality >= 0.5) {
                  this.successfulSubmits++;
                }
              } else {
                lastCompilationSuccess = parsed.success ?? null;
                lastCompilationErrors = parsed.errors ?? [];
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Continue the conversation
      response = await complete(this.model, context);
      context.messages.push(response);
    }

    // 3. Record this iteration to synaptic memory
    if (this.memory && lastTargetFile) {
      // Extract a brief approach description from the agent's last text
      const textParts = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');
      const approach = textParts.length > 100
        ? textParts.substring(0, 100) + '...'
        : textParts || 'No text summary';

      const outcome = lastQuality !== null
        ? `quality=${lastQuality.toFixed(2)}, ${lastCompilationSuccess ? 'compiled' : 'compilation failed'}`
        : 'no submission';

      this.memory.appendSynapticEntry(this.id, {
        iteration: iterationNum,
        timestamp: Date.now(),
        targetFile: lastTargetFile,
        action: lastAction,
        quality: lastQuality,
        compilationSuccess: lastCompilationSuccess,
        compilationErrors: lastCompilationErrors.slice(0, 3),
        approach,
        outcome,
      });
    }

    // Log iteration summary
    const textContent = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('');

    if (textContent) {
      // Truncate long messages for logging
      const summary = textContent.length > 200
        ? textContent.substring(0, 200) + '...'
        : textContent;
      console.log(`[${this.id}] Iteration ${iterationNum}: ${summary.replace(/\n/g, ' ')}`);
    } else {
      console.log(`[${this.id}] Iteration ${iterationNum}: completed (${toolCallCount} tool calls)`);
    }
  }

  /**
   * Execute a single tool call and return the result message
   */
  private async executeToolCall(toolCall: ToolCall): Promise<ToolResultMessage> {
    const { name, arguments: args, id } = toolCall;
    let resultText: string;
    let isError = false;

    try {
      switch (name) {
        case 'perceive_environment':
          resultText = await this.handlers.perceive_environment(args as any);
          break;
        case 'read_file_solution':
          resultText = await this.handlers.read_file_solution(args as any);
          break;
        case 'submit_solution':
          resultText = await this.handlers.submit_solution(args as any);
          break;
        case 'compile_check':
          resultText = await this.handlers.compile_check(args as any);
          break;
        case 'read_signals':
          resultText = await this.handlers.read_signals(args as any);
          break;
        case 'read_trail_markers':
          resultText = await this.handlers.read_trail_markers(args as any);
          break;
        case 'leave_trail_marker':
          resultText = await this.handlers.leave_trail_marker(args as any);
          break;
        default:
          resultText = JSON.stringify({ error: `Unknown tool: ${name}` });
          isError = true;
      }
    } catch (error: any) {
      resultText = JSON.stringify({ error: error.message || 'Tool execution failed' });
      isError = true;
    }

    return {
      role: 'toolResult',
      toolCallId: id,
      toolName: name,
      content: [{ type: 'text', text: resultText }],
      isError,
      timestamp: Date.now(),
    };
  }

  /**
   * Signal the agent to stop
   */
  stop(): void {
    this.shouldStop = true;
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
