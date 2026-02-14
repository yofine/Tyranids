/**
 * SynapticMemory - Markdown-based persistence & agent memory
 *
 * Biometric metaphor:
 * - Synaptic Memory (per-agent): Individual neural pathways — what this agent learned
 * - Hive State (shared): The Hive Mind's collective pheromone map
 * - Trail Markers (per-file): Stigmergy — agents leave notes on files for others to read
 *
 * All writes are non-blocking (fire-and-forget via enqueueWrite).
 * All reads are async and awaited when data is needed.
 */

import { writeFile, appendFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SwarmEnvironment } from './environment.js';
import type { SynapticMemoryConfig } from './types.js';

// ============================================================
// Types
// ============================================================

/** A single entry in an agent's synaptic memory */
export interface SynapticEntry {
  iteration: number;
  timestamp: number;
  targetFile: string;
  action: 'explore' | 'submit' | 'compile_check';
  quality: number | null;
  compilationSuccess: boolean | null;
  compilationErrors: string[];
  approach: string;
  outcome: string;
}

/** A trail marker left on a file by an agent (stigmergy) */
export interface TrailMarker {
  agentId: string;
  timestamp: number;
  iteration: number;
  quality: number;
  compilationSuccess: boolean;
  compilationErrors: string[];
  exports: string[];
  recommendation: string;
}

// ============================================================
// SynapticMemory Class
// ============================================================

export class SynapticMemory {
  private baseDir: string;
  private synapsesDir: string;
  private trailsDir: string;
  private maxSynapticEntries: number;
  private maxTrailMarkers: number;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config?: SynapticMemoryConfig) {
    const base = config?.baseDir ?? process.cwd();
    this.baseDir = join(base, '.swarm-memory');
    this.synapsesDir = join(this.baseDir, 'synapses');
    this.trailsDir = join(this.baseDir, 'trails');
    this.maxSynapticEntries = config?.maxSynapticEntries ?? 10;
    this.maxTrailMarkers = config?.maxTrailMarkers ?? 5;
  }

  // ---- Lifecycle ----

  /** Initialize directory structure. Called once at swarm start. */
  async initialize(): Promise<void> {
    await mkdir(this.synapsesDir, { recursive: true });
    await mkdir(this.trailsDir, { recursive: true });
    console.log(`[SynapticMemory] Initialized at ${this.baseDir}`);
  }

  // ---- Non-blocking write queue ----

  private enqueueWrite(fn: () => Promise<void>): void {
    this.writeQueue = this.writeQueue.then(fn).catch(err => {
      console.error(`[SynapticMemory] Write error: ${err.message}`);
    });
  }

  /** Wait for all pending writes to complete */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  // ---- Agent Synaptic Memory (per-agent) ----

  /** Append an entry to an agent's synapse file (non-blocking) */
  appendSynapticEntry(agentId: string, entry: SynapticEntry): void {
    this.enqueueWrite(async () => {
      const filePath = join(this.synapsesDir, `${agentId}.md`);
      const block = this.formatSingleEntry(entry);

      try {
        await appendFile(filePath, block);
      } catch {
        // File doesn't exist yet — create with header
        await writeFile(filePath, `# Synaptic Memory: ${agentId}\n\n${block}`);
      }
    });
  }

  /** Read an agent's synapse file, returning formatted markdown for context injection */
  async readSynapticMemory(agentId: string): Promise<string> {
    const filePath = join(this.synapsesDir, `${agentId}.md`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const entries = this.parseSynapticFile(content);
      const recent = entries.slice(-this.maxSynapticEntries);
      return this.formatSynapticSummary(recent);
    } catch {
      return ''; // No memory yet
    }
  }

  // ---- Trail Markers (per-file stigmergy) ----

  /** Deposit a trail marker on a file (non-blocking) */
  depositTrailMarker(filePath: string, marker: TrailMarker): void {
    this.enqueueWrite(async () => {
      const encoded = this.encodeFilePath(filePath);
      const mdPath = join(this.trailsDir, `${encoded}.md`);
      const block = this.formatTrailMarkerEntry(marker);

      try {
        await appendFile(mdPath, block);
      } catch {
        await writeFile(mdPath, `# Trail Markers: ${filePath}\n\n${block}`);
      }
    });
  }

  /** Read trail markers for a file, returns formatted markdown */
  async readTrailMarkers(filePath: string): Promise<string> {
    const encoded = this.encodeFilePath(filePath);
    const mdPath = join(this.trailsDir, `${encoded}.md`);
    try {
      const content = await readFile(mdPath, 'utf-8');
      const markers = this.parseTrailMarkerFile(content);
      const recent = markers.slice(-this.maxTrailMarkers);
      return this.formatTrailMarkerSummary(filePath, recent);
    } catch {
      return ''; // No markers yet
    }
  }

  // ---- Hive State (shared environment snapshot) ----

  /** Write a full environment snapshot to hive-state.md (non-blocking) */
  snapshotHiveState(env: SwarmEnvironment): void {
    this.enqueueWrite(async () => {
      const slots = env.getAllFileSlots();
      const convergence = env.calculateGlobalConvergence();
      const solidCount = slots.filter(
        s => s.status === 'solid' || s.status === 'excellent'
      ).length;

      const lines = [
        '# Hive State Snapshot',
        `*Updated: ${new Date().toISOString()}*\n`,
        '## Global Progress',
        `- **Convergence**: ${(convergence * 100).toFixed(0)}%`,
        `- **Files Solid+**: ${solidCount}/${slots.length}`,
        '',
        '## File Slots\n',
      ];

      for (const slot of slots) {
        const best = env.getBestSolution(slot.filePath);
        const signals = env.getSignals(slot.filePath);
        const activeCount = env.getActiveAgentCount(slot.filePath);
        const pheromones = env.getFilePheromones(slot.filePath);

        lines.push(`### ${slot.filePath} [${slot.status.toUpperCase()}]`);
        lines.push(`- Quality: ${slot.bestQuality.toFixed(2)}`);
        lines.push(`- Active Agents: ${activeCount}`);
        lines.push(`- Solutions: ${pheromones.length}`);

        if (signals.length > 0) {
          lines.push(`- Signals: ${signals.length} (${signals.map(s => s.type).join(', ')})`);
        }
        if (best) {
          lines.push(`- Exports: [${best.exports.join(', ')}]`);
        }
        if (slot.dependsOn.length > 0) {
          lines.push(`- Depends on: ${slot.dependsOn.join(', ')}`);
        }
        lines.push('');
      }

      await writeFile(join(this.baseDir, 'hive-state.md'), lines.join('\n'));
    });
  }

  /** Update the dependency map from current environment state (non-blocking) */
  snapshotDependencyMap(env: SwarmEnvironment): void {
    this.enqueueWrite(async () => {
      const slots = env.getAllFileSlots();
      const lines = [
        '# Dependency Map',
        `*Updated: ${new Date().toISOString()}*\n`,
        '## Dependency Graph\n',
        '```',
      ];

      for (const slot of slots) {
        const deps = slot.dependsOn.length > 0
          ? ` (depends on: ${slot.dependsOn.join(', ')})`
          : ' (no deps)';
        lines.push(`${slot.filePath}${deps}`);
      }
      lines.push('```\n');

      // Compatibility matrix
      lines.push('## Compatibility Matrix\n');
      lines.push('| Dependent | Dependency | Required Exports | Available | Status |');
      lines.push('|-----------|-----------|-----------------|-----------|--------|');

      for (const slot of slots) {
        for (const depPath of slot.dependsOn) {
          const best = env.getBestSolution(slot.filePath);
          const depBest = env.getBestSolution(depPath);

          if (best && depBest) {
            // Find what this file imports from the dependency
            const neededImports = best.imports
              .filter(i => i.fromFile === depPath)
              .map(i => i.name);

            if (neededImports.length > 0) {
              const available = depBest.exports;
              const allFound = neededImports.every(n => available.includes(n));
              lines.push(
                `| ${slot.filePath} | ${depPath} | [${neededImports.join(', ')}] | [${available.join(', ')}] | ${allFound ? 'OK' : 'MISMATCH'} |`
              );
            }
          } else {
            const status = depBest ? 'no solution for dependent' : 'no solution for dependency';
            lines.push(
              `| ${slot.filePath} | ${depPath} | ? | ? | ${status} |`
            );
          }
        }
      }
      lines.push('');

      await writeFile(join(this.baseDir, 'dependency-map.md'), lines.join('\n'));
    });
  }

  /** Append a quality event to the quality log (non-blocking) */
  appendQualityEvent(
    filePath: string,
    agentId: string,
    quality: number,
    compilationSuccess: boolean
  ): void {
    this.enqueueWrite(async () => {
      const logPath = join(this.baseDir, 'quality-log.md');
      const time = new Date().toISOString().slice(11, 19);
      const status = compilationSuccess ? 'COMPILED' : 'FAILED';
      const line = `| ${time} | ${filePath} | ${agentId} | ${quality.toFixed(2)} | ${status} |\n`;

      try {
        await appendFile(logPath, line);
      } catch {
        const header = [
          '# Quality Log\n',
          '| Time | File | Agent | Quality | Compilation |',
          '|------|------|-------|---------|-------------|',
          '',
        ].join('\n');
        await writeFile(logPath, header + line);
      }
    });
  }

  // ---- Internal helpers ----

  /** Encode file path for use as a filename */
  private encodeFilePath(filePath: string): string {
    return filePath.replace(/\//g, '--');
  }

  /** Format a single synaptic entry as markdown block */
  private formatSingleEntry(entry: SynapticEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const lines = [
      `\n## Iteration ${entry.iteration} [${time}]`,
      `- **Target**: ${entry.targetFile}`,
      `- **Action**: ${entry.action}`,
    ];

    if (entry.quality !== null) {
      lines.push(`- **Quality**: ${entry.quality.toFixed(2)}`);
    }
    if (entry.compilationSuccess !== null) {
      lines.push(`- **Compilation**: ${entry.compilationSuccess ? 'SUCCESS' : 'FAILED'}`);
    }
    if (entry.compilationErrors.length > 0) {
      lines.push(`- **Errors**: ${entry.compilationErrors.slice(0, 3).join('; ')}`);
    }
    if (entry.approach) {
      lines.push(`- **Approach**: ${entry.approach}`);
    }
    if (entry.outcome) {
      lines.push(`- **Outcome**: ${entry.outcome}`);
    }

    return lines.join('\n') + '\n';
  }

  /** Parse a synaptic memory markdown file into entries */
  private parseSynapticFile(content: string): SynapticEntry[] {
    const entries: SynapticEntry[] = [];
    const blocks = content.split(/\n## Iteration /).slice(1); // Skip header

    for (const block of blocks) {
      try {
        const iterMatch = block.match(/^(\d+)/);
        const targetMatch = block.match(/\*\*Target\*\*:\s*(.+)/);
        const actionMatch = block.match(/\*\*Action\*\*:\s*(.+)/);
        const qualityMatch = block.match(/\*\*Quality\*\*:\s*([\d.]+)/);
        const compMatch = block.match(/\*\*Compilation\*\*:\s*(SUCCESS|FAILED)/);
        const errorsMatch = block.match(/\*\*Errors\*\*:\s*(.+)/);
        const approachMatch = block.match(/\*\*Approach\*\*:\s*(.+)/);
        const outcomeMatch = block.match(/\*\*Outcome\*\*:\s*(.+)/);

        entries.push({
          iteration: iterMatch ? parseInt(iterMatch[1]) : 0,
          timestamp: 0,
          targetFile: targetMatch?.[1]?.trim() ?? '',
          action: (actionMatch?.[1]?.trim() as SynapticEntry['action']) ?? 'explore',
          quality: qualityMatch ? parseFloat(qualityMatch[1]) : null,
          compilationSuccess: compMatch ? compMatch[1] === 'SUCCESS' : null,
          compilationErrors: errorsMatch ? errorsMatch[1].split('; ') : [],
          approach: approachMatch?.[1]?.trim() ?? '',
          outcome: outcomeMatch?.[1]?.trim() ?? '',
        });
      } catch {
        // Skip malformed entries
      }
    }

    return entries;
  }

  /** Format recent entries as a compact summary for context injection */
  private formatSynapticSummary(entries: SynapticEntry[]): string {
    if (entries.length === 0) return '';

    const lines = ['## Your Past Iterations\n'];

    for (const e of entries) {
      const status = e.compilationSuccess === null ? '?' :
        e.compilationSuccess ? 'OK' : 'FAIL';
      const qual = e.quality !== null ? e.quality.toFixed(2) : 'n/a';
      lines.push(`- Iter ${e.iteration}: ${e.action} ${e.targetFile} [${status}, q=${qual}]`);

      if (e.compilationErrors.length > 0) {
        lines.push(`  Errors: ${e.compilationErrors.slice(0, 2).join('; ')}`);
      }
      if (e.outcome) {
        lines.push(`  ${e.outcome}`);
      }
    }

    // Derive learned patterns
    const failedFiles = new Map<string, number>();
    const succeededFiles = new Map<string, number>();

    for (const e of entries) {
      const map = e.compilationSuccess ? succeededFiles : failedFiles;
      map.set(e.targetFile, (map.get(e.targetFile) ?? 0) + 1);
    }

    if (failedFiles.size > 0 || succeededFiles.size > 0) {
      lines.push('\n## Patterns');
      if (failedFiles.size > 0) {
        const items = [...failedFiles.entries()].map(([f, n]) => `${f}(${n}x)`);
        lines.push(`- Past failures: ${items.join(', ')}`);
      }
      if (succeededFiles.size > 0) {
        const items = [...succeededFiles.entries()].map(([f, n]) => `${f}(${n}x)`);
        lines.push(`- Past successes: ${items.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /** Format a single trail marker entry */
  private formatTrailMarkerEntry(marker: TrailMarker): string {
    const time = new Date(marker.timestamp).toISOString().slice(11, 19);
    const status = marker.compilationSuccess ? 'SUCCESS' : 'FAILED';
    const lines = [
      `\n## ${marker.agentId} [Iter ${marker.iteration}, ${time}]`,
      `- Quality: ${marker.quality.toFixed(2)} | Compilation: ${status}`,
    ];

    if (marker.exports.length > 0) {
      lines.push(`- Exports: [${marker.exports.join(', ')}]`);
    }
    if (marker.compilationErrors.length > 0) {
      lines.push(`- Errors: ${marker.compilationErrors.slice(0, 2).join('; ')}`);
    }
    if (marker.recommendation) {
      lines.push(`- **Note**: ${marker.recommendation}`);
    }

    return lines.join('\n') + '\n';
  }

  /** Parse a trail markers markdown file */
  private parseTrailMarkerFile(content: string): TrailMarker[] {
    const markers: TrailMarker[] = [];
    const blocks = content.split(/\n## /).slice(1); // Skip header

    for (const block of blocks) {
      try {
        const headerMatch = block.match(/^([\w-]+)\s+\[Iter (\d+)/);
        const qualityMatch = block.match(/Quality:\s*([\d.]+)/);
        const compMatch = block.match(/Compilation:\s*(SUCCESS|FAILED)/);
        const exportsMatch = block.match(/Exports:\s*\[([^\]]*)\]/);
        const errorsMatch = block.match(/Errors:\s*(.+)/);
        const noteMatch = block.match(/\*\*Note\*\*:\s*(.+)/);

        markers.push({
          agentId: headerMatch?.[1] ?? '',
          timestamp: 0,
          iteration: headerMatch ? parseInt(headerMatch[2]) : 0,
          quality: qualityMatch ? parseFloat(qualityMatch[1]) : 0,
          compilationSuccess: compMatch ? compMatch[1] === 'SUCCESS' : false,
          compilationErrors: errorsMatch ? errorsMatch[1].split('; ') : [],
          exports: exportsMatch?.[1] ? exportsMatch[1].split(', ').filter(Boolean) : [],
          recommendation: noteMatch?.[1]?.trim() ?? '',
        });
      } catch {
        // Skip malformed entries
      }
    }

    return markers;
  }

  /** Format trail markers as compact summary */
  private formatTrailMarkerSummary(filePath: string, markers: TrailMarker[]): string {
    if (markers.length === 0) return '';

    const lines = [`## Trail Markers for ${filePath}\n`];

    for (const m of markers) {
      const status = m.compilationSuccess ? 'OK' : 'FAIL';
      lines.push(`- ${m.agentId} (iter ${m.iteration}): [${status}, q=${m.quality.toFixed(2)}]`);

      if (m.exports.length > 0) {
        lines.push(`  Exports: [${m.exports.join(', ')}]`);
      }
      if (m.compilationErrors.length > 0) {
        lines.push(`  Errors: ${m.compilationErrors.slice(0, 2).join('; ')}`);
      }
      if (m.recommendation) {
        lines.push(`  Note: ${m.recommendation}`);
      }
    }

    return lines.join('\n');
  }
}
