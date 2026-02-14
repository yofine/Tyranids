/**
 * SelfEvolution - The swarm can modify its own source code
 *
 * Safety mechanisms:
 * 1. Snapshot before any modification
 * 2. Patches stored as diff records
 * 3. Compile verification before accepting changes
 * 4. Automatic rollback on failure
 * 5. Hot-reload via child_process.fork()
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { complete, type Model, type Api, type Context } from '@mariozechner/pi-ai';
import { TyranidWorkspace } from './workspace.js';
import type { EvolutionProposal, EvolutionResult, FilePatch } from './types.js';

/** Files the swarm is allowed to modify */
const MUTABLE_FILES = [
  'packages/swarm-core/src/swarm-tools.ts',
  'packages/swarm-core/src/environment-agent.ts',
  'packages/swarm-core/src/evaluator.ts',
  'packages/swarm-core/src/bioengine/bioforms.ts',
  'packages/swarm-core/src/environment.ts',
  'packages/swarm-core/src/environment-orchestrator.ts',
];

export class SelfEvolution {
  private workspace: TyranidWorkspace;
  private model: Model<Api>;
  private projectRoot: string;

  constructor(workspace: TyranidWorkspace, model: Model<Api>) {
    this.workspace = workspace;
    this.model = model;
    // The Tyranids project root (where packages/ lives)
    this.projectRoot = this.findProjectRoot();
  }

  // ── Analyze & Propose ────────────────────────────────

  /**
   * Use LLM to analyze swarm source and propose modifications.
   */
  async analyzeAndPropose(
    feedback: string,
    targetFiles?: string[]
  ): Promise<EvolutionProposal> {
    const files = targetFiles ?? MUTABLE_FILES;

    // Read current source
    let sourceContext = '';
    for (const relPath of files) {
      const absPath = join(this.projectRoot, relPath);
      if (existsSync(absPath)) {
        const content = await readFile(absPath, 'utf-8');
        sourceContext += `\n### ${relPath}\n\`\`\`typescript\n${content}\n\`\`\`\n`;
      }
    }

    const context: Context = {
      systemPrompt: `You are an evolution engine for the Tyranids swarm system.
Analyze the source code and propose targeted modifications based on feedback.

Return JSON with this structure:
{
  "description": "short description of changes",
  "estimatedImpact": "low|medium|high",
  "reasoning": "why these changes improve the system",
  "patches": [
    {
      "filePath": "relative/path.ts",
      "before": "exact string to replace (must match exactly)",
      "after": "replacement string"
    }
  ]
}

Rules:
- Only modify files from the provided list
- Make minimal, targeted changes
- Preserve all existing exports and interfaces
- Never break backward compatibility
- Each patch.before must be a unique string in the file
- Return ONLY the JSON, no other text`,
      messages: [{
        role: 'user',
        content: `Feedback: ${feedback}\n\nCurrent source files:${sourceContext}\n\nPropose evolution patches.`,
        timestamp: Date.now(),
      }],
    };

    const response = await complete(this.model, context);
    const text = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        id: `evo-${Date.now()}`,
        description: 'No changes proposed',
        patches: [],
        estimatedImpact: 'low',
        reasoning: 'LLM did not return valid patches',
      };
    }

    const raw = JSON.parse(jsonMatch[0]);
    return {
      id: `evo-${Date.now()}`,
      description: String(raw.description ?? ''),
      patches: Array.isArray(raw.patches) ? raw.patches.map((p: Record<string, string>) => ({
        filePath: String(p.filePath ?? ''),
        before: String(p.before ?? ''),
        after: String(p.after ?? ''),
      })) : [],
      estimatedImpact: raw.estimatedImpact ?? 'medium',
      reasoning: String(raw.reasoning ?? ''),
    };
  }

  // ── Execute Evolution ────────────────────────────────

  /**
   * Apply patches, compile, and verify. Rollback on failure.
   */
  async evolve(proposal: EvolutionProposal): Promise<EvolutionResult> {
    if (proposal.patches.length === 0) {
      return {
        success: false,
        snapshotId: '',
        proposalId: proposal.id,
        errors: ['No patches to apply'],
        rebuiltSuccessfully: false,
      };
    }

    // 1. Create snapshot
    const snapshotId = `snap-${Date.now()}`;
    await this.createSnapshot(snapshotId, proposal.patches);

    // 2. Apply patches
    const patchErrors: string[] = [];
    for (const patch of proposal.patches) {
      try {
        await this.applyPatch(patch);
      } catch (err: any) {
        patchErrors.push(`${patch.filePath}: ${err.message}`);
      }
    }

    if (patchErrors.length > 0) {
      await this.rollback(snapshotId);
      return {
        success: false,
        snapshotId,
        proposalId: proposal.id,
        errors: patchErrors,
        rebuiltSuccessfully: false,
      };
    }

    // 3. Rebuild
    const buildResult = await this.rebuild();
    if (!buildResult.success) {
      await this.rollback(snapshotId);
      return {
        success: false,
        snapshotId,
        proposalId: proposal.id,
        errors: buildResult.errors,
        rebuiltSuccessfully: false,
      };
    }

    // 4. Save the proposal as a patch record
    await this.savePatchRecord(proposal);

    // 5. Update workspace evolution generation
    const info = await this.workspace.readWorkspaceInfo();
    info.evolutionGeneration++;
    await this.workspace.updateWorkspaceInfo(info);

    return {
      success: true,
      snapshotId,
      proposalId: proposal.id,
      errors: [],
      rebuiltSuccessfully: true,
    };
  }

  // ── Rollback ─────────────────────────────────────────

  async rollback(snapshotId: string): Promise<void> {
    const snapshotDir = join(this.workspace.getEvolutionDir(), 'snapshots', snapshotId);
    if (!existsSync(snapshotDir)) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const manifest = JSON.parse(
      await readFile(join(snapshotDir, 'manifest.json'), 'utf-8')
    ) as { files: string[] };

    for (const relPath of manifest.files) {
      const snapshotFile = join(snapshotDir, relPath.replace(/\//g, '--'));
      const targetFile = join(this.projectRoot, relPath);
      if (existsSync(snapshotFile)) {
        const content = await readFile(snapshotFile, 'utf-8');
        await writeFile(targetFile, content);
      }
    }

    // Rebuild after rollback
    await this.rebuild();
  }

  // ── Rebuild ──────────────────────────────────────────

  async rebuild(): Promise<{ success: boolean; errors: string[] }> {
    try {
      execSync('npm run build', {
        cwd: this.projectRoot,
        timeout: 60000,
        stdio: 'pipe',
      });
      return { success: true, errors: [] };
    } catch (err: any) {
      const stderr = err.stderr?.toString() ?? '';
      const stdout = err.stdout?.toString() ?? '';
      const output = stderr || stdout;
      const errors = output
        .split('\n')
        .filter((l: string) => l.includes('error TS'))
        .slice(0, 10);
      return { success: false, errors: errors.length > 0 ? errors : ['Build failed'] };
    }
  }

  // ── Hot Reload ───────────────────────────────────────

  /**
   * Restart the CLI process to pick up rebuilt code.
   * The caller (cli.ts) should handle the actual process restart.
   */
  async hotReload(): Promise<void> {
    // Signal the CLI to restart by writing a marker file
    const markerPath = join(this.workspace.workspaceDir, '.reload-requested');
    await writeFile(markerPath, new Date().toISOString());
  }

  // ── Private Helpers ──────────────────────────────────

  private findProjectRoot(): string {
    // Walk up from workspace to find package.json with workspaces
    let dir = this.workspace.projectDir;
    for (let i = 0; i < 10; i++) {
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'));
          if (pkg.workspaces || pkg.name === 'tyranids-monorepo') {
            return dir;
          }
        } catch {
          // continue
        }
      }
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
    return this.workspace.projectDir;
  }

  private async createSnapshot(snapshotId: string, patches: FilePatch[]): Promise<void> {
    const snapshotDir = join(this.workspace.getEvolutionDir(), 'snapshots', snapshotId);
    await mkdir(snapshotDir, { recursive: true });

    const files: string[] = [];
    for (const patch of patches) {
      const absPath = join(this.projectRoot, patch.filePath);
      if (existsSync(absPath)) {
        const content = await readFile(absPath, 'utf-8');
        const safeName = patch.filePath.replace(/\//g, '--');
        await writeFile(join(snapshotDir, safeName), content);
        files.push(patch.filePath);
      }
    }

    await writeFile(
      join(snapshotDir, 'manifest.json'),
      JSON.stringify({ files, timestamp: Date.now() }, null, 2)
    );
  }

  private async applyPatch(patch: FilePatch): Promise<void> {
    const absPath = join(this.projectRoot, patch.filePath);
    if (!existsSync(absPath)) {
      throw new Error(`File not found: ${patch.filePath}`);
    }

    // Security check: only allow mutable files
    if (!MUTABLE_FILES.includes(patch.filePath)) {
      throw new Error(`File not in mutable list: ${patch.filePath}`);
    }

    let content = await readFile(absPath, 'utf-8');

    if (!content.includes(patch.before)) {
      throw new Error(`Patch target not found in ${patch.filePath}`);
    }

    content = content.replace(patch.before, patch.after);
    await writeFile(absPath, content);
  }

  private async savePatchRecord(proposal: EvolutionProposal): Promise<void> {
    const patchDir = join(this.workspace.getEvolutionDir(), 'patches');
    await mkdir(patchDir, { recursive: true });

    const md = `# Evolution: ${proposal.id}

## Description
${proposal.description}

## Impact
${proposal.estimatedImpact}

## Reasoning
${proposal.reasoning}

## Patches
${proposal.patches.map(p => `### ${p.filePath}\nBefore:\n\`\`\`\n${p.before.slice(0, 200)}\n\`\`\`\nAfter:\n\`\`\`\n${p.after.slice(0, 200)}\n\`\`\``).join('\n\n')}
`;
    await writeFile(join(patchDir, `${proposal.id}.md`), md);
  }
}
