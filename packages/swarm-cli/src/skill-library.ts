/**
 * SkillLibrary - Learn, store, match, and inject reusable skills
 *
 * Skills are markdown files in both global (~/.tyranids/skills/)
 * and project (.tyranids/skills/) directories.
 *
 * After each successful swarm task, the system calls extractSkills()
 * to distill patterns from generated code into reusable skills.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { complete, type Model, type Api, type Context } from '@mariozechner/pi-ai';
import { TyranidWorkspace } from './workspace.js';
import type { Skill, SkillMeta } from './types.js';

export class SkillLibrary {
  private workspace: TyranidWorkspace;

  constructor(workspace: TyranidWorkspace) {
    this.workspace = workspace;
  }

  // ── CRUD ─────────────────────────────────────────────

  async listSkills(category?: string): Promise<SkillMeta[]> {
    const skills: SkillMeta[] = [];

    // Global skills
    const globalDir = join(TyranidWorkspace.getGlobalHome(), 'skills');
    await this.scanSkillDir(globalDir, skills);

    // Project skills (can override global)
    const projectDir = this.workspace.getSkillsDir();
    await this.scanSkillDir(projectDir, skills);

    // Deduplicate by name (project overrides global)
    const seen = new Map<string, SkillMeta>();
    for (const s of skills) {
      seen.set(s.name, s);
    }

    let result = Array.from(seen.values());
    if (category) {
      result = result.filter(s => s.category === category);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSkill(name: string): Promise<Skill | null> {
    // Check project first, then global
    const projectPath = join(this.workspace.getSkillsDir(), `${name}.md`);
    if (existsSync(projectPath)) {
      return this.parseSkillFile(await readFile(projectPath, 'utf-8'));
    }

    const globalPath = join(TyranidWorkspace.getGlobalHome(), 'skills', `${name}.md`);
    if (existsSync(globalPath)) {
      return this.parseSkillFile(await readFile(globalPath, 'utf-8'));
    }

    return null;
  }

  async saveSkill(skill: Skill, global: boolean = true): Promise<void> {
    const dir = global
      ? join(TyranidWorkspace.getGlobalHome(), 'skills')
      : this.workspace.getSkillsDir();

    const md = this.skillToMarkdown(skill);
    await writeFile(join(dir, `${skill.name}.md`), md);
    await this.updateRegistry(dir);
  }

  async deleteSkill(name: string): Promise<void> {
    const { unlink } = await import('node:fs/promises');
    const projectPath = join(this.workspace.getSkillsDir(), `${name}.md`);
    if (existsSync(projectPath)) {
      await unlink(projectPath);
    }
    const globalPath = join(TyranidWorkspace.getGlobalHome(), 'skills', `${name}.md`);
    if (existsSync(globalPath)) {
      await unlink(globalPath);
    }
  }

  // ── Skill Extraction (LLM-driven) ───────────────────

  /**
   * After a successful task, extract reusable skills from the generated code.
   */
  async extractSkills(
    taskDescription: string,
    generatedFiles: Map<string, string>,
    model: Model<Api>
  ): Promise<Skill[]> {
    // Build the prompt
    let filesContent = '';
    for (const [path, content] of generatedFiles) {
      filesContent += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
    }

    const context: Context = {
      systemPrompt: `You extract reusable skills from completed tasks.
A "skill" is a design pattern, architecture approach, technique, or methodology that could be reused.

Return JSON array of skills. Each skill:
{
  "name": "kebab-case-skill-name",
  "category": "one of: parsing, architecture, algorithm, pattern, testing, io, research, writing, analysis",
  "complexity": "low|medium|high",
  "language": "the primary language or domain (e.g. typescript, python, markdown, general)",
  "pattern": "1-2 sentence description of the pattern",
  "template": "key structure (pseudocode, skeleton, or methodology outline)",
  "whenToUse": ["bullet point conditions"],
  "lessonsLearned": ["bullet point lessons"],
  "keywords": ["search keywords"]
}

Only extract genuinely reusable patterns. Skip trivial boilerplate.
Return ONLY the JSON array, no other text.`,
      messages: [{
        role: 'user',
        content: `Task: ${taskDescription}\n\nGenerated files:${filesContent}\n\nExtract reusable skills from this completed task.`,
        timestamp: Date.now(),
      }],
    };

    try {
      const response = await complete(model, context);
      const text = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      const skills: Skill[] = [];

      for (const r of raw) {
        const skill: Skill = {
          name: String(r.name ?? ''),
          category: String(r.category ?? 'pattern'),
          complexity: (r.complexity as Skill['complexity']) ?? 'medium',
          language: String(r.language ?? 'typescript'),
          learnedAt: new Date().toISOString(),
          source: taskDescription.slice(0, 80),
          successRate: '1/1',
          pattern: String(r.pattern ?? ''),
          template: String(r.template ?? ''),
          whenToUse: Array.isArray(r.whenToUse) ? r.whenToUse.map(String) : [],
          lessonsLearned: Array.isArray(r.lessonsLearned) ? r.lessonsLearned.map(String) : [],
          keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
        };

        if (skill.name && skill.pattern) {
          await this.saveSkill(skill);
          skills.push(skill);
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  // ── Skill Matching ───────────────────────────────────

  /**
   * Find skills relevant to a task description via keyword matching.
   */
  async matchSkills(taskDescription: string, limit: number = 5): Promise<Skill[]> {
    const allMeta = await this.listSkills();
    const words = taskDescription.toLowerCase().split(/\s+/);

    const scored: { name: string; score: number }[] = [];

    for (const meta of allMeta) {
      let score = 0;
      const targets = [
        ...meta.keywords,
        meta.category,
        meta.name.replace(/-/g, ' '),
      ].map(s => s.toLowerCase());

      for (const word of words) {
        for (const target of targets) {
          if (target.includes(word) || word.includes(target)) {
            score++;
          }
        }
      }

      if (score > 0) {
        scored.push({ name: meta.name, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const matched: Skill[] = [];
    for (const { name } of scored.slice(0, limit)) {
      const skill = await this.getSkill(name);
      if (skill) matched.push(skill);
    }

    return matched;
  }

  // ── Agent Context Injection ──────────────────────────

  /**
   * Format skills into a text block suitable for injecting into agent context.
   */
  formatSkillsForAgent(skills: Skill[]): string {
    if (skills.length === 0) return '';

    let text = '--- LOADED SKILLS ---\n';
    for (const s of skills) {
      text += `\n## ${s.name} (${s.category})\n`;
      text += `${s.pattern}\n`;
      if (s.template) {
        text += `Template:\n\`\`\`\n${s.template}\n\`\`\`\n`;
      }
      if (s.lessonsLearned.length > 0) {
        text += `Lessons: ${s.lessonsLearned.join('; ')}\n`;
      }
    }
    text += '--- END SKILLS ---\n';
    return text;
  }

  // ── Private Helpers ──────────────────────────────────

  private async scanSkillDir(dir: string, out: SkillMeta[]): Promise<void> {
    if (!existsSync(dir)) return;
    const files = await readdir(dir);

    for (const file of files.filter(f => f.endsWith('.md') && f !== 'registry.md')) {
      try {
        const content = await readFile(join(dir, file), 'utf-8');
        const skill = this.parseSkillFile(content);
        if (skill) {
          out.push({
            name: skill.name,
            category: skill.category,
            complexity: skill.complexity,
            language: skill.language,
            keywords: skill.keywords,
          });
        }
      } catch {
        // skip malformed
      }
    }
  }

  private parseSkillFile(content: string): Skill | null {
    const name = content.match(/# Skill:\s*(.+)/)?.[1]?.trim();
    if (!name) return null;

    const category = content.match(/- Category:\s*(.+)/)?.[1]?.trim() ?? 'pattern';
    const complexity = (content.match(/- Complexity:\s*(.+)/)?.[1]?.trim() ?? 'medium') as Skill['complexity'];
    const language = content.match(/- Language:\s*(.+)/)?.[1]?.trim() ?? 'typescript';
    const learnedAt = content.match(/- Learned:\s*(.+)/)?.[1]?.trim() ?? '';
    const source = content.match(/- Source:\s*(.+)/)?.[1]?.trim() ?? '';
    const successRate = content.match(/- Success Rate:\s*(.+)/)?.[1]?.trim() ?? '';

    const patternMatch = content.match(/## Pattern\n([\s\S]*?)(?=\n##|$)/);
    const pattern = patternMatch?.[1]?.trim() ?? '';

    const templateMatch = content.match(/## Template\n```[\w]*\n([\s\S]*?)```/);
    const template = templateMatch?.[1]?.trim() ?? '';

    const whenToUse: string[] = [];
    const whenSection = content.match(/## When to Use\n([\s\S]*?)(?=\n##|$)/);
    if (whenSection) {
      for (const m of whenSection[1].matchAll(/- (.+)/g)) {
        whenToUse.push(m[1].trim());
      }
    }

    const lessonsLearned: string[] = [];
    const lessonsSection = content.match(/## Lessons Learned\n([\s\S]*?)(?=\n##|$)/);
    if (lessonsSection) {
      for (const m of lessonsSection[1].matchAll(/- (.+)/g)) {
        lessonsLearned.push(m[1].trim());
      }
    }

    // Extract keywords from metadata or from name + category
    const keywordsLine = content.match(/- Keywords:\s*(.+)/)?.[1]?.trim();
    const keywords = keywordsLine
      ? keywordsLine.split(',').map(k => k.trim())
      : [...name.split('-'), category];

    return {
      name, category, complexity, language, learnedAt, source,
      successRate, pattern, template, whenToUse, lessonsLearned, keywords,
    };
  }

  private skillToMarkdown(skill: Skill): string {
    let md = `# Skill: ${skill.name}\n\n## Metadata\n`;
    md += `- Category: ${skill.category}\n`;
    md += `- Complexity: ${skill.complexity}\n`;
    md += `- Language: ${skill.language}\n`;
    md += `- Learned: ${skill.learnedAt}\n`;
    md += `- Source: ${skill.source}\n`;
    md += `- Success Rate: ${skill.successRate}\n`;
    md += `- Keywords: ${skill.keywords.join(', ')}\n`;

    md += `\n## Pattern\n${skill.pattern}\n`;

    if (skill.template) {
      md += `\n## Template\n\`\`\`typescript\n${skill.template}\n\`\`\`\n`;
    }

    if (skill.whenToUse.length > 0) {
      md += `\n## When to Use\n`;
      for (const w of skill.whenToUse) md += `- ${w}\n`;
    }

    if (skill.lessonsLearned.length > 0) {
      md += `\n## Lessons Learned\n`;
      for (const l of skill.lessonsLearned) md += `- ${l}\n`;
    }

    return md;
  }

  private async updateRegistry(dir: string): Promise<void> {
    if (!existsSync(dir)) return;
    const files = await readdir(dir);
    const skillFiles = files.filter(f => f.endsWith('.md') && f !== 'registry.md');

    let md = '# Skill Registry\n\n';
    md += `Total: ${skillFiles.length} skills\n\n`;

    for (const file of skillFiles.sort()) {
      const name = file.replace('.md', '');
      md += `- [${name}](./${file})\n`;
    }

    await writeFile(join(dir, 'registry.md'), md);
  }
}
