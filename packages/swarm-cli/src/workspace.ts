/**
 * TyranidWorkspace - Two-level workspace management
 *
 * Information hierarchy:
 *
 * GLOBAL (~/.tyranids/) — the swarm's own identity & memory
 *   ├── config.md           # LLM provider, model preferences
 *   ├── gene-pool/          # BioEngine evolution history
 *   ├── skills/             # Global skill library (cross-project)
 *   ├── evolution/          # Self-modification patches & snapshots
 *   │   ├── patches/
 *   │   └── snapshots/
 *   └── workspace.md        # Global metadata (total skills, evolution gen)
 *
 * PROJECT (<cwd>/.tyranids/) — project-specific work products
 *   ├── workspace.md        # Project metadata (name, task count)
 *   ├── tasks/              # Task history (task-001.md, ...)
 *   ├── generated/          # Generated code per task
 *   ├── skills/             # Project-specific skills (override global)
 *   └── .swarm-memory/      # Synaptic memory for this project
 *       ├── hive-state.md
 *       ├── synapses/
 *       └── trails/
 *
 * Key rule: tasks, generated code, and swarm-memory are ALWAYS project-level.
 * If no project workspace exists, task operations require --init first.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import type {
  WorkspaceInfo,
  GlobalConfig,
  TaskRecord,
  TaskResult,
} from './types.js';

const TYRANIDS_DIR = '.tyranids';
const GLOBAL_HOME = join(homedir(), '.tyranids');

export class TyranidWorkspace {
  readonly projectDir: string;
  readonly workspaceDir: string;
  /** Whether this is a global-only workspace (no project --init) */
  readonly isGlobal: boolean;

  private constructor(projectDir: string, isGlobal: boolean) {
    this.projectDir = projectDir;
    this.workspaceDir = join(projectDir, TYRANIDS_DIR);
    this.isGlobal = isGlobal;
  }

  // ── Lifecycle ────────────────────────────────────────

  /**
   * Walk up from cwd to find the nearest project-level .tyranids/.
   * Skips ~/.tyranids/ (that's global, not a project).
   * If no project workspace found, returns a global-only workspace.
   */
  static async discover(cwd: string): Promise<TyranidWorkspace> {
    await TyranidWorkspace.ensureGlobalHome();

    let dir = cwd;
    while (true) {
      const candidate = join(dir, TYRANIDS_DIR);
      if (existsSync(candidate) && candidate !== GLOBAL_HOME) {
        return new TyranidWorkspace(dir, false);
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // No project workspace — global-only mode
    return new TyranidWorkspace(homedir(), true);
  }

  /**
   * Initialize a new project-level workspace in the given directory.
   */
  static async initialize(projectDir: string): Promise<TyranidWorkspace> {
    const ws = new TyranidWorkspace(projectDir, false);

    // Project-level directories
    await mkdir(join(ws.workspaceDir, '.swarm-memory', 'synapses'), { recursive: true });
    await mkdir(join(ws.workspaceDir, '.swarm-memory', 'trails'), { recursive: true });
    await mkdir(join(ws.workspaceDir, 'tasks'), { recursive: true });
    await mkdir(join(ws.workspaceDir, 'generated'), { recursive: true });
    await mkdir(join(ws.workspaceDir, 'skills'), { recursive: true });

    // Write project workspace.md
    const info: WorkspaceInfo = {
      projectName: basename(projectDir),
      projectDir,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      totalTasks: 0,
      totalSkills: 0,
      evolutionGeneration: 0,
    };
    await ws.updateWorkspaceInfo(info);

    // Ensure global home also exists
    await TyranidWorkspace.ensureGlobalHome();

    return ws;
  }

  // ── Project-Level Paths (tasks, generated, memory) ──

  /**
   * Synaptic memory dir — project-level only.
   * Throws if no project workspace.
   */
  getSwarmMemoryDir(): string {
    this.requireProject('swarm memory');
    return join(this.workspaceDir, '.swarm-memory');
  }

  /**
   * Task history dir — project-level only.
   */
  getTaskDir(): string {
    this.requireProject('tasks');
    return join(this.workspaceDir, 'tasks');
  }

  /**
   * Generated code dir — project-level only.
   */
  getGeneratedDir(): string {
    this.requireProject('generated code');
    return join(this.workspaceDir, 'generated');
  }

  // ── Shared Paths (skills, evolution) ─────────────────

  /**
   * Skills dir — project-level if available, otherwise global.
   * Project skills override global ones (checked by SkillLibrary).
   */
  getSkillsDir(): string {
    if (this.isGlobal) {
      return join(GLOBAL_HOME, 'skills');
    }
    return join(this.workspaceDir, 'skills');
  }

  /**
   * Evolution dir — always global (swarm modifies its own code).
   */
  getEvolutionDir(): string {
    return join(GLOBAL_HOME, 'evolution');
  }

  /**
   * Check if a project workspace is available.
   */
  hasProject(): boolean {
    return !this.isGlobal;
  }

  // ── Task Management (project-level only) ─────────────

  async createTask(description: string): Promise<TaskRecord> {
    this.requireProject('creating tasks');
    await mkdir(this.getTaskDir(), { recursive: true });

    const info = await this.readWorkspaceInfo();
    const taskNum = info.totalTasks + 1;
    const id = `task-${String(taskNum).padStart(3, '0')}`;

    const record: TaskRecord = {
      id,
      description,
      createdAt: new Date().toISOString(),
      status: 'pending',
      complexity: 'simple',
      agentsUsed: 0,
      filesGenerated: [],
      skillsLearned: [],
    };

    const md = this.taskRecordToMarkdown(record);
    await writeFile(join(this.getTaskDir(), `${id}.md`), md);

    info.totalTasks = taskNum;
    info.lastActiveAt = new Date().toISOString();
    await this.updateWorkspaceInfo(info);

    return record;
  }

  async completeTask(taskId: string, result: TaskResult): Promise<void> {
    this.requireProject('completing tasks');
    const filePath = join(this.getTaskDir(), `${taskId}.md`);
    let record: TaskRecord;

    try {
      const content = await readFile(filePath, 'utf-8');
      record = this.parseTaskRecord(content);
    } catch {
      throw new Error(`Task ${taskId} not found`);
    }

    record.status = 'completed';
    record.completedAt = new Date().toISOString();
    record.convergence = result.convergence;
    record.duration = result.duration;
    record.filesGenerated = [...result.files.keys()];
    record.skillsLearned = result.skillsLearned;

    await writeFile(filePath, this.taskRecordToMarkdown(record));
  }

  async getTaskHistory(): Promise<TaskRecord[]> {
    if (this.isGlobal) return [];
    const dir = this.getTaskDir();
    if (!existsSync(dir)) return [];

    const files = await readdir(dir);
    const records: TaskRecord[] = [];

    for (const file of files.filter(f => f.endsWith('.md'))) {
      try {
        const content = await readFile(join(dir, file), 'utf-8');
        records.push(this.parseTaskRecord(content));
      } catch {
        // skip malformed
      }
    }

    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  // ── Workspace Info ───────────────────────────────────

  async readWorkspaceInfo(): Promise<WorkspaceInfo> {
    const filePath = join(this.workspaceDir, 'workspace.md');
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseWorkspaceInfo(content);
    } catch {
      return {
        projectName: this.isGlobal ? 'global' : basename(this.projectDir),
        projectDir: this.projectDir,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        totalTasks: 0,
        totalSkills: 0,
        evolutionGeneration: 0,
      };
    }
  }

  async updateWorkspaceInfo(info: WorkspaceInfo): Promise<void> {
    await mkdir(this.workspaceDir, { recursive: true });
    const md = `# Tyranid Workspace

## Metadata
- Project: ${info.projectName}
- Directory: ${info.projectDir}
- Created: ${info.createdAt}
- Last Active: ${info.lastActiveAt}
- Total Tasks: ${info.totalTasks}
- Total Skills: ${info.totalSkills}
- Evolution Generation: ${info.evolutionGeneration}
`;
    await writeFile(join(this.workspaceDir, 'workspace.md'), md);
  }

  // ── Global Home ──────────────────────────────────────

  static getGlobalHome(): string {
    return GLOBAL_HOME;
  }

  /**
   * Ensure ~/.tyranids/ has the global-level directory structure.
   * Global = swarm's own config, skills, evolution, gene-pool.
   * NO tasks/generated/.swarm-memory — those are project-level.
   */
  static async ensureGlobalHome(): Promise<void> {
    await mkdir(join(GLOBAL_HOME, 'skills'), { recursive: true });
    await mkdir(join(GLOBAL_HOME, 'gene-pool'), { recursive: true });
    await mkdir(join(GLOBAL_HOME, 'evolution', 'patches'), { recursive: true });
    await mkdir(join(GLOBAL_HOME, 'evolution', 'snapshots'), { recursive: true });

    // Global config
    const configPath = join(GLOBAL_HOME, 'config.md');
    if (!existsSync(configPath)) {
      await writeFile(configPath, `# Tyranid Global Config

## Provider
- Provider: minimax
- Model: MiniMax-M2.1

## Providers
### minimax
- Model: MiniMax-M2.1

### anthropic
- Model: claude-haiku-4-5-20241022
`);
    }
  }

  static async readGlobalConfig(): Promise<GlobalConfig> {
    await TyranidWorkspace.ensureGlobalHome();
    const configPath = join(GLOBAL_HOME, 'config.md');

    try {
      const content = await readFile(configPath, 'utf-8');
      const provider = content.match(/- Provider:\s*(.+)/)?.[1]?.trim() ?? 'minimax';
      const model = content.match(/- Model:\s*(.+)/)?.[1]?.trim() ?? 'MiniMax-M2.1';
      return { provider, modelName: model };
    } catch {
      return { provider: 'minimax', modelName: 'MiniMax-M2.1' };
    }
  }

  // ── Private Helpers ──────────────────────────────────

  private requireProject(operation: string): void {
    if (this.isGlobal) {
      throw new Error(
        `No project workspace found for ${operation}. ` +
        `Run "tyranids --init" in your project directory first.`
      );
    }
  }

  private taskRecordToMarkdown(record: TaskRecord): string {
    let md = `# Task: ${record.id}

## Metadata
- Description: ${record.description}
- Created: ${record.createdAt}
- Status: ${record.status}
- Complexity: ${record.complexity}
- Agents Used: ${record.agentsUsed}
`;
    if (record.completedAt) md += `- Completed: ${record.completedAt}\n`;
    if (record.convergence !== undefined) md += `- Convergence: ${(record.convergence * 100).toFixed(0)}%\n`;
    if (record.duration !== undefined) md += `- Duration: ${(record.duration / 1000).toFixed(1)}s\n`;
    if (record.filesGenerated.length > 0) {
      md += `\n## Files Generated\n`;
      for (const f of record.filesGenerated) md += `- ${f}\n`;
    }
    if (record.skillsLearned.length > 0) {
      md += `\n## Skills Learned\n`;
      for (const s of record.skillsLearned) md += `- ${s}\n`;
    }
    return md;
  }

  private parseTaskRecord(content: string): TaskRecord {
    const id = content.match(/# Task:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    const description = content.match(/- Description:\s*(.+)/)?.[1]?.trim() ?? '';
    const createdAt = content.match(/- Created:\s*(.+)/)?.[1]?.trim() ?? '';
    const status = (content.match(/- Status:\s*(.+)/)?.[1]?.trim() ?? 'pending') as TaskRecord['status'];
    const complexity = (content.match(/- Complexity:\s*(.+)/)?.[1]?.trim() ?? 'simple') as TaskRecord['complexity'];
    const agentsUsed = parseInt(content.match(/- Agents Used:\s*(\d+)/)?.[1] ?? '0', 10);
    const completedAt = content.match(/- Completed:\s*(.+)/)?.[1]?.trim();
    const convergenceMatch = content.match(/- Convergence:\s*(\d+)%/);
    const convergence = convergenceMatch ? parseInt(convergenceMatch[1], 10) / 100 : undefined;
    const durationMatch = content.match(/- Duration:\s*([\d.]+)s/);
    const duration = durationMatch ? parseFloat(durationMatch[1]) * 1000 : undefined;

    const filesGenerated: string[] = [];
    const filesSection = content.match(/## Files Generated\n([\s\S]*?)(?=\n##|$)/);
    if (filesSection) {
      for (const match of filesSection[1].matchAll(/- (.+)/g)) {
        filesGenerated.push(match[1].trim());
      }
    }

    const skillsLearned: string[] = [];
    const skillsSection = content.match(/## Skills Learned\n([\s\S]*?)(?=\n##|$)/);
    if (skillsSection) {
      for (const match of skillsSection[1].matchAll(/- (.+)/g)) {
        skillsLearned.push(match[1].trim());
      }
    }

    return {
      id, description, createdAt, completedAt, status, complexity,
      agentsUsed, filesGenerated, skillsLearned, convergence, duration,
    };
  }

  private parseWorkspaceInfo(content: string): WorkspaceInfo {
    return {
      projectName: content.match(/- Project:\s*(.+)/)?.[1]?.trim() ?? '',
      projectDir: content.match(/- Directory:\s*(.+)/)?.[1]?.trim() ?? '',
      createdAt: content.match(/- Created:\s*(.+)/)?.[1]?.trim() ?? '',
      lastActiveAt: content.match(/- Last Active:\s*(.+)/)?.[1]?.trim() ?? '',
      totalTasks: parseInt(content.match(/- Total Tasks:\s*(\d+)/)?.[1] ?? '0', 10),
      totalSkills: parseInt(content.match(/- Total Skills:\s*(\d+)/)?.[1] ?? '0', 10),
      evolutionGeneration: parseInt(content.match(/- Evolution Generation:\s*(\d+)/)?.[1] ?? '0', 10),
    };
  }
}
