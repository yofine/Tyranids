/**
 * Gatekeeper - Single Agent interaction layer
 *
 * Receives user input, assesses complexity, and decides:
 * - Simple: answer directly with single LLM call
 * - Moderate/Complex: escalate to swarm via HiveMind
 */

import { complete, type Model, type Api, type Context } from '@mariozechner/pi-ai';
import { SkillLibrary } from './skill-library.js';
import type {
  ComplexityAssessment,
  GatekeeperResponse,
} from './types.js';

export class Gatekeeper {
  private model: Model<Api>;
  private skillLibrary: SkillLibrary;
  private conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  constructor(
    skillLibrary: SkillLibrary,
    model: Model<Api>,
  ) {
    this.model = model;
    this.skillLibrary = skillLibrary;
  }

  /**
   * Handle a user message — assess complexity and respond accordingly.
   */
  async handleMessage(input: string): Promise<GatekeeperResponse> {
    // First, assess the complexity of the request
    const assessment = await this.assessComplexity(input);

    if (assessment.level === 'simple') {
      // Handle directly with a single LLM call
      const text = await this.handleSimple(input);
      return { type: 'simple', text };
    }

    // Moderate or complex — return assessment for swarm escalation
    return {
      type: 'swarm_started',
      taskId: '', // Will be filled by caller
      assessment,
    };
  }

  /**
   * Assess the complexity of a user request using LLM.
   */
  async assessComplexity(input: string): Promise<ComplexityAssessment> {
    // Load relevant skills to inform complexity assessment
    const matchedSkills = await this.skillLibrary.matchSkills(input, 3);
    const skillNames = matchedSkills.map(s => s.name);

    const context: Context = {
      systemPrompt: `You are a task complexity assessor for a swarm intelligence system.
Analyze the user's request and determine its complexity level.
The swarm can handle any task type: coding, research, writing, analysis, design, etc.

Return JSON with this structure:
{
  "level": "simple" | "moderate" | "complex",
  "reasoning": "why this complexity level",
  "suggestedAgentCount": <number 1-10>,
  "requiredSkills": ["skill-name-1", "skill-name-2"],
  "fileStructure": [
    {
      "filePath": "path/to/artifact",
      "description": "what this artifact does",
      "dependsOn": ["path/to/dependency"]
    }
  ]
}

Classification rules:
- "simple": Questions, explanations, single-file tasks, quick lookups
  → suggestedAgentCount: 1
- "moderate": 2-3 artifacts with dependencies, medium features, multi-step analysis
  → suggestedAgentCount: 2-3
- "complex": 4+ artifacts, cross-module architecture, full features, deep research
  → suggestedAgentCount: 3-8

fileStructure is required for "moderate" and "complex" levels.
Return ONLY the JSON, no other text.`,
      messages: [{
        role: 'user',
        content: `User request: ${input}\n\nAvailable skills: ${skillNames.length > 0 ? skillNames.join(', ') : 'none'}`,
        timestamp: Date.now(),
      }],
    };

    try {
      const response = await complete(this.model, context);
      const text = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.defaultAssessment(input);
      }

      const raw = JSON.parse(jsonMatch[0]);
      return {
        level: raw.level ?? 'simple',
        reasoning: String(raw.reasoning ?? ''),
        suggestedAgentCount: Number(raw.suggestedAgentCount ?? 1),
        requiredSkills: Array.isArray(raw.requiredSkills) ? raw.requiredSkills.map(String) : [],
        fileStructure: Array.isArray(raw.fileStructure)
          ? raw.fileStructure.map((f: Record<string, unknown>) => ({
              filePath: String(f.filePath ?? ''),
              description: String(f.description ?? ''),
              dependsOn: Array.isArray(f.dependsOn) ? f.dependsOn.map(String) : [],
            }))
          : undefined,
      };
    } catch {
      return this.defaultAssessment(input);
    }
  }

  /**
   * Handle a simple request directly with a single LLM call.
   */
  private async handleSimple(input: string): Promise<string> {
    // Load relevant skills as context
    const skills = await this.skillLibrary.matchSkills(input, 3);
    const skillContext = this.skillLibrary.formatSkillsForAgent(skills);

    // Build conversation history as system prompt context
    let historyContext = '';
    if (this.conversationHistory.length > 0) {
      historyContext = '\n\nConversation history:\n' +
        this.conversationHistory.map(m =>
          `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n\n');
    }

    // Add current message to history
    this.conversationHistory.push({ role: 'user', content: input });

    const context: Context = {
      systemPrompt: `You are Tyranids, a swarm intelligence assistant.
You help with tasks ranging from coding to research, writing, analysis, and problem-solving.
Be concise and direct. When the task involves code, write working code.
When the task involves other domains, provide well-structured, thorough responses.
${skillContext}${historyContext}`,
      messages: [{
        role: 'user',
        content: input,
        timestamp: Date.now(),
      }],
    };

    try {
      const response = await complete(this.model, context);
      const text = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      // Add assistant response to conversation
      this.conversationHistory.push({ role: 'assistant', content: text });

      // Keep conversation history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-16);
      }

      return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error: ${msg}`;
    }
  }

  /**
   * Default assessment when LLM fails.
   */
  private defaultAssessment(input: string): ComplexityAssessment {
    // Simple heuristic: long inputs with task-oriented keywords → complex
    const words = input.split(/\s+/).length;
    const complexKeywords = [
      'implement', 'create', 'build', 'design', 'architecture', 'system',
      'analyze', 'research', 'compare', 'evaluate', 'comprehensive',
      'multi-file', 'module', 'parser', 'compiler', 'pipeline',
      '多文件', '实现', '构建', '设计', '分析', '系统',
    ];
    const hasComplexKeyword = complexKeywords.some(k => input.toLowerCase().includes(k));

    if (words > 30 && hasComplexKeyword) {
      return {
        level: 'complex',
        reasoning: 'Long request with complex task keywords',
        suggestedAgentCount: 5,
        requiredSkills: [],
      };
    }
    if (hasComplexKeyword) {
      return {
        level: 'moderate',
        reasoning: 'Request contains task-oriented keywords',
        suggestedAgentCount: 3,
        requiredSkills: [],
      };
    }
    return {
      level: 'simple',
      reasoning: 'Short or simple request',
      suggestedAgentCount: 1,
      requiredSkills: [],
    };
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}
