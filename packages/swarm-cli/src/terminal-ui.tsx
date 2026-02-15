/**
 * TerminalUI - ink (React for CLI) rendering engine for Tyranids CLI
 *
 * Two modes:
 * - TTY: Full ink (React for terminal) with interactive input, spinners,
 *   live-updating swarm dashboard, and `<Static>` for persistent output.
 * - Pipe: Plain console.log output with readline input. No ink — ANSI cursor
 *   manipulation doesn't work in pipes so ink would just accumulate garbage.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, Static, useInput, useApp, type Key } from 'ink';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import type {
  UIMode,
  SwarmEvent,
  SwarmDashboardState,
  WorkspaceInfo,
  FileStatusSnapshot,
} from './types.js';

// ── Static item types ─────────────────────────────────

type StaticItem =
  | { id: number; kind: 'logo' }
  | { id: number; kind: 'message'; role: 'user' | 'assistant' | 'system'; content: string }
  | { id: number; kind: 'task_complete'; info: TaskCompleteInfo }
  | { id: number; kind: 'evolution_proposal'; proposal: EvolutionProposalInfo }
  | { id: number; kind: 'skills_list'; skills: SkillInfo[] };

interface TaskCompleteInfo {
  files: [string, string][];
  convergence: number;
  duration: number;
  skillsLearned: string[];
}

interface EvolutionProposalInfo {
  description: string;
  estimatedImpact: string;
  reasoning: string;
  patchCount: number;
}

interface SkillInfo {
  name: string;
  category: string;
  complexity: string;
}

// ── App state ─────────────────────────────────────────

interface AppState {
  mode: UIMode;
  processing: boolean;
  events: SwarmEvent[];
  items: StaticItem[];
  dashboard: SwarmDashboardState | null;
  confirmQuestion: string | null;
}

type StateUpdater = (fn: (prev: AppState) => AppState) => void;

let itemIdCounter = 0;

// ── Helper Components (ink only) ──────────────────────

const LOGO_LINES = [
  '  ████████╗██╗   ██╗██████╗  █████╗ ███╗   ██╗██╗██████╗ ███████╗',
  '  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔══██╗████╗  ██║██║██╔══██╗██╔════╝',
  '     ██║    ╚████╔╝ ██████╔╝███████║██╔██╗ ██║██║██║  ██║███████╗',
  '     ██║     ╚██╔╝  ██╔══██╗██╔══██║██║╚██╗██║██║██║  ██║╚════██║',
  '     ██║      ██║   ██║  ██║██║  ██║██║ ╚████║██║██████╔╝███████║',
  '     ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═════╝ ╚══════╝',
];

const TAGLINE = '  Swarm Intelligence CLI — Devour. Adapt. Evolve.';

function LogoView() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {LOGO_LINES.map((line: string, i: number) => (
        <Text key={i} color="red">{line}</Text>
      ))}
      <Text dimColor>{TAGLINE}</Text>
      <Text> </Text>
    </Box>
  );
}

function QualityBar({ quality, width = 10 }: { quality: number; width?: number }) {
  const filled = Math.round(quality * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const color = quality >= 0.80 ? 'green' : quality >= 0.60 ? 'yellow' : quality > 0 ? 'red' : 'gray';
  return <Text color={color}>[{bar}]</Text>;
}

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, [string, string | undefined]> = {
    excellent: ['\u2713\u2713', 'green'],
    solid: ['\u2713', 'green'],
    partial: ['\u27F3', 'yellow'],
    attempted: ['\u25CB', 'red'],
    blocked: ['\u2717', 'red'],
    empty: ['\u00B7', undefined],
  };
  const [icon, color] = icons[status] ?? ['?', undefined];
  return color ? <Text color={color}>{icon}</Text> : <Text dimColor>{icon}</Text>;
}

function FileStatusRow({ file }: { file: FileStatusSnapshot }) {
  const name = file.filePath.length > 20
    ? file.filePath.slice(-20)
    : file.filePath.padEnd(20);
  return (
    <Box gap={1}>
      <Text>{name}</Text>
      <QualityBar quality={file.quality} />
      <Text>{file.quality.toFixed(2)}</Text>
      <StatusIcon status={file.status} />
      <Text dimColor>{file.activeAgent ?? '-'}</Text>
    </Box>
  );
}

function formatPercent(value: number): string {
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(0)}%`;
}

function formatEvent(event: SwarmEvent): { text: string; color: string } {
  switch (event.type) {
    case 'agent_spawned':
      return { text: `+ Agent ${event.agentId} spawned (total: ${event.total})`, color: 'green' };
    case 'agent_retired':
      return { text: `- Agent ${event.agentId} retired: ${event.reason}`, color: 'red' };
    case 'solution_submitted':
      return { text: `\u2191 ${event.agentId} submitted ${event.file} (${event.quality.toFixed(2)})`, color: 'blue' };
    case 'solution_reinforced':
      return { text: `\u2605 ${event.file} reinforced: ${event.quality.toFixed(2)} (${event.depositors} depositors)`, color: 'cyan' };
    case 'convergence_update':
      return { text: `\u25C9 Convergence: ${formatPercent(event.percentage)}`, color: 'yellow' };
    case 'skill_loaded':
      return { text: `\u26A1 Skill loaded: ${event.skillName}`, color: 'magenta' };
    case 'evolution_triggered':
      return { text: `\uD83E\uDDEC Evolution: ${event.description}`, color: 'red' };
    case 'scaling':
      return { text: `\u21C5 Scale ${event.direction.toUpperCase()}: ${event.from}\u2192${event.to} (${event.reason})`, color: 'yellow' };
    case 'task_complete': {
      const dur = (event.duration / 1000).toFixed(1);
      return { text: `\u2713 Task complete: ${event.filesGenerated} files, ${formatPercent(event.convergence)} convergence, ${dur}s`, color: 'green' };
    }
  }
}

function formatEventPlain(event: SwarmEvent): string {
  return formatEvent(event).text;
}

function TaskCompleteSummary({ info }: { info: TaskCompleteInfo }) {
  return (
    <Box flexDirection="column" marginY={1} paddingLeft={1}>
      <Text bold color="green">{'\u2550'.repeat(3)} Task Complete {'\u2550'.repeat(3)}</Text>
      <Text>  Files generated: {info.files.length}</Text>
      <Text>  Convergence: {formatPercent(info.convergence)}</Text>
      <Text>  Duration: {(info.duration / 1000).toFixed(1)}s</Text>
      {info.skillsLearned.length > 0 && (
        <Text>  Skills learned: {info.skillsLearned.join(', ')}</Text>
      )}
      <Box flexDirection="column" marginTop={1}>
        {info.files.map(([path, code]: [string, string]) => (
          <Text key={path} dimColor>  {path} ({code.split('\n').length} lines)</Text>
        ))}
      </Box>
    </Box>
  );
}

function EvolutionProposalView({ proposal }: { proposal: EvolutionProposalInfo }) {
  return (
    <Box flexDirection="column" marginY={1} paddingLeft={1}>
      <Text bold color="magenta">Evolution Proposal:</Text>
      <Text>  Description: {proposal.description}</Text>
      <Text>  Impact: {proposal.estimatedImpact}</Text>
      <Text>  Reasoning: {proposal.reasoning}</Text>
      <Text>  Patches: {proposal.patchCount}</Text>
    </Box>
  );
}

function SkillsListView({ skills }: { skills: SkillInfo[] }) {
  if (skills.length === 0) {
    return <Text dimColor>  No skills learned yet.</Text>;
  }
  return (
    <Box flexDirection="column">
      <Text bold>  Skills Library:</Text>
      {skills.map((s: SkillInfo) => {
        const compColor = s.complexity === 'high' ? 'red' : s.complexity === 'medium' ? 'yellow' : 'green';
        return (
          <Box key={s.name} gap={1} paddingLeft={1}>
            <Text color="cyan">{s.name}</Text>
            <Text>[{s.category}]</Text>
            <Text color={compColor}>{s.complexity}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Live swarm dashboard (re-renders in place) ─────────

function SwarmDashboard({ dashboard, events }: { dashboard: SwarmDashboardState | null; events: SwarmEvent[] }) {
  return (
    <Box flexDirection="column" marginY={1}>
      {dashboard && (
        <>
          <Box gap={1}>
            <Text bold color="yellow">[SWARM ACTIVE]</Text>
            <Text>{dashboard.totalAgents} agents</Text>
            <Text dimColor>|</Text>
            <Text>Convergence: {formatPercent(dashboard.convergence)}</Text>
            <Text dimColor>|</Text>
            <Text>Skills: {dashboard.skillsLoaded}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} paddingLeft={1}>
            {dashboard.files.map((f: FileStatusSnapshot) => (
              <FileStatusRow key={f.filePath} file={f} />
            ))}
          </Box>
        </>
      )}
      {events.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingLeft={1}>
          <Text dimColor>Recent events:</Text>
          {events.slice(-8).map((evt: SwarmEvent, i: number) => {
            const { text, color } = formatEvent(evt);
            return <Text key={i} color={color}>  {text}</Text>;
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Static item renderer ────────────────────────────────

function StaticItemView({ item }: { item: StaticItem }) {
  switch (item.kind) {
    case 'logo':
      return <LogoView />;
    case 'message':
      return (
        <Box paddingLeft={1} flexDirection="column">
          {item.role === 'user' && <Text color="green">&gt; {item.content}</Text>}
          {item.role === 'assistant' && (
            <Box flexDirection="column">
              <Text color="cyan">  Tyranids:</Text>
              {item.content.split('\n').map((line: string, i: number) => (
                <Text key={i}>  {line}</Text>
              ))}
            </Box>
          )}
          {item.role === 'system' && <Text dimColor>  {item.content}</Text>}
        </Box>
      );
    case 'task_complete':
      return <TaskCompleteSummary info={item.info} />;
    case 'evolution_proposal':
      return <EvolutionProposalView proposal={item.proposal} />;
    case 'skills_list':
      return <SkillsListView skills={item.skills} />;
  }
}

// ── Main App Component (TTY only) ─────────────────────

function App({
  stateRef,
  setStateRef,
  onInput,
  onConfirmResolve,
}: {
  stateRef: React.MutableRefObject<AppState>;
  setStateRef: React.MutableRefObject<StateUpdater | null>;
  onInput: React.MutableRefObject<((input: string) => Promise<void> | void) | null>;
  onConfirmResolve: React.MutableRefObject<((yes: boolean) => void) | null>;
}) {
  const [state, setState] = useState<AppState>(stateRef.current);
  const [inputValue, setInputValue] = useState('');
  const { exit } = useApp();

  // Expose setState to the imperative bridge
  useEffect(() => {
    setStateRef.current = (fn: (prev: AppState) => AppState) => {
      setState((prev: AppState) => {
        const next = fn(prev);
        stateRef.current = next;
        return next;
      });
    };
  }, [setStateRef, stateRef]);

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInputValue('');

    // Handle confirm mode
    if (state.confirmQuestion) {
      const yes = trimmed.toLowerCase().startsWith('y');
      if (onConfirmResolve.current) {
        onConfirmResolve.current(yes);
        onConfirmResolve.current = null;
      }
      setState((prev: AppState) => ({ ...prev, confirmQuestion: null }));
      return;
    }

    if (onInput.current) {
      await onInput.current(trimmed);
    }
  }, [state.confirmQuestion, onInput, onConfirmResolve]);

  // Ctrl+C to exit
  useInput((_input: string, key: Key) => {
    if (key.ctrl && _input === 'c') {
      exit();
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Static items: logo, messages, summaries — rendered once, never reprinted */}
      <Static items={state.items}>
        {(item: StaticItem) => (
          <Box key={item.id}>
            <StaticItemView item={item} />
          </Box>
        )}
      </Static>

      {/* Live swarm dashboard (re-renders in place) */}
      {state.mode === 'swarm' && (
        <SwarmDashboard dashboard={state.dashboard} events={state.events} />
      )}

      {/* Processing spinner */}
      {state.processing && (
        <Box paddingLeft={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text dimColor> thinking...</Text>
        </Box>
      )}

      {/* Confirm question */}
      {state.confirmQuestion && (
        <Box paddingLeft={1}>
          <Text color="yellow">  {state.confirmQuestion} (y/n) </Text>
        </Box>
      )}

      {/* Input prompt */}
      {!state.processing && (
        <Box paddingLeft={1}>
          <Text color="green">&gt; </Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
          />
        </Box>
      )}
    </Box>
  );
}

// ── TerminalUI class (imperative bridge) ─────────────────

export class TerminalUI {
  private stateRef: { current: AppState };
  private setStateRef: { current: StateUpdater | null } = { current: null };
  private inputCallbackRef: { current: ((input: string) => Promise<void> | void) | null } = { current: null };
  private confirmResolveRef: { current: ((yes: boolean) => void) | null } = { current: null };
  private inkInstance: ReturnType<typeof render> | null = null;
  private rl: ReadlineInterface | null = null;
  private pendingWork: Promise<void> | null = null;
  private isTTY: boolean;

  constructor() {
    this.isTTY = Boolean(process.stdin.isTTY);
    this.stateRef = {
      current: {
        mode: 'chat',
        processing: false,
        events: [],
        items: [{ id: ++itemIdCounter, kind: 'logo' }],
        dashboard: null,
        confirmQuestion: null,
      },
    };
  }

  // ── Lifecycle ─────────────────────────────────────────

  start(): void {
    if (this.isTTY) {
      this.startInk();
    } else {
      this.startPipe();
    }
  }

  private startInk(): void {
    const element = React.createElement(App, {
      stateRef: this.stateRef,
      setStateRef: this.setStateRef,
      onInput: this.inputCallbackRef,
      onConfirmResolve: this.confirmResolveRef,
    });

    this.inkInstance = render(element, {
      patchConsole: false,
    });
  }

  private startPipe(): void {
    // In pipe mode, print the logo immediately via console.log
    for (const line of LOGO_LINES) {
      console.log(line);
    }
    console.log(TAGLINE);
    console.log();

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
    });

    this.rl.on('line', (line: string) => {
      const input = line.trim();
      if (!input) return;

      if (this.inputCallbackRef.current) {
        const work = (async () => {
          try {
            await this.inputCallbackRef.current!(input);
          } catch {
            // errors handled by callback
          }
        })();
        this.pendingWork = work;
      }
    });

    this.rl.on('close', () => {
      setTimeout(async () => {
        if (this.pendingWork) {
          await this.pendingWork;
        }
        process.exit(0);
      }, 100);
    });
  }

  stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
  }

  // ── Input ─────────────────────────────────────────────

  onInput(callback: (input: string) => Promise<void> | void): void {
    this.inputCallbackRef.current = callback;
  }

  renderPrompt(): void {
    // ink handles prompt rendering via React — no-op
  }

  async confirm(question: string): Promise<boolean> {
    if (!this.isTTY) {
      return true;
    }
    return new Promise((resolve) => {
      this.confirmResolveRef.current = resolve;
      this.updateState(prev => ({ ...prev, confirmQuestion: question }));
    });
  }

  // ── Mode Switching ────────────────────────────────────

  switchToChat(): void {
    this.updateState(prev => ({
      ...prev,
      mode: 'chat',
    }));
  }

  switchToSwarm(): void {
    this.updateState(prev => ({
      ...prev,
      mode: 'swarm',
    }));
  }

  switchToEvolution(): void {
    this.updateState(prev => ({
      ...prev,
      mode: 'evolution',
    }));
  }

  // ── Rendering ─────────────────────────────────────────

  renderHeader(info: WorkspaceInfo): void {
    const lines = [
      `Workspace: ${info.projectDir}`,
      `Tasks: ${info.totalTasks} | Skills: ${info.totalSkills} | Evolution: gen-${info.evolutionGeneration}`,
    ].join('\n');

    if (this.isTTY) {
      this.pushItem({ id: ++itemIdCounter, kind: 'message', role: 'system', content: lines });
    } else {
      console.log(lines);
    }
  }

  printAssistantMessage(text: string): void {
    if (this.isTTY) {
      this.updateState(prev => ({
        ...prev,
        processing: false,
        items: [...prev.items, { id: ++itemIdCounter, kind: 'message', role: 'assistant', content: text }],
      }));
    } else {
      console.log(`Tyranids: ${text}`);
    }
  }

  printSystemMessage(text: string): void {
    if (this.isTTY) {
      this.pushItem({ id: ++itemIdCounter, kind: 'message', role: 'system', content: text });
    } else {
      console.log(`[system] ${text}`);
    }
  }

  setProcessing(active: boolean): void {
    this.updateState(prev => ({ ...prev, processing: active }));
  }

  // ── Swarm Dashboard ───────────────────────────────────

  pushEvent(event: SwarmEvent): void {
    if (this.isTTY) {
      this.updateState(prev => {
        const events = [...prev.events, event].slice(-8);
        const dashboard = this.updateDashboardFromEvent(prev.dashboard, event);
        return { ...prev, events, dashboard };
      });
    } else {
      console.log(formatEventPlain(event));
    }
  }

  renderSwarmDashboard(state: SwarmDashboardState): void {
    this.updateState(prev => ({ ...prev, dashboard: state }));
  }

  renderTaskComplete(
    files: Map<string, string>,
    convergence: number,
    duration: number,
    skillsLearned: string[],
  ): void {
    if (this.isTTY) {
      this.pushItem({
        id: ++itemIdCounter,
        kind: 'task_complete',
        info: {
          files: [...files.entries()],
          convergence,
          duration,
          skillsLearned,
        },
      });
    } else {
      console.log(`--- Task Complete ---`);
      console.log(`  Files: ${files.size}`);
      console.log(`  Convergence: ${formatPercent(convergence)}`);
      console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
      if (skillsLearned.length > 0) {
        console.log(`  Skills learned: ${skillsLearned.join(', ')}`);
      }
      for (const [path, code] of files) {
        console.log(`  ${path} (${code.split('\n').length} lines)`);
      }
    }
  }

  renderSkillsList(skills: { name: string; category: string; complexity: string }[]): void {
    if (this.isTTY) {
      this.pushItem({ id: ++itemIdCounter, kind: 'skills_list', skills });
    } else {
      if (skills.length === 0) {
        console.log('No skills learned yet.');
      } else {
        console.log('Skills Library:');
        for (const s of skills) {
          console.log(`  ${s.name} [${s.category}] ${s.complexity}`);
        }
      }
    }
  }

  renderWorkspaceStatus(info: WorkspaceInfo): void {
    const lines = [
      `Workspace Status:`,
      `  Project: ${info.projectName}`,
      `  Directory: ${info.projectDir}`,
      `  Created: ${info.createdAt}`,
      `  Last Active: ${info.lastActiveAt}`,
      `  Total Tasks: ${info.totalTasks}`,
      `  Total Skills: ${info.totalSkills}`,
      `  Evolution Generation: ${info.evolutionGeneration}`,
    ].join('\n');
    this.printSystemMessage(lines);
  }

  renderEvolutionProposal(proposal: {
    description: string;
    estimatedImpact: string;
    reasoning: string;
    patchCount: number;
  }): void {
    if (this.isTTY) {
      this.pushItem({ id: ++itemIdCounter, kind: 'evolution_proposal', proposal });
    } else {
      console.log(`Evolution Proposal:`);
      console.log(`  Description: ${proposal.description}`);
      console.log(`  Impact: ${proposal.estimatedImpact}`);
      console.log(`  Reasoning: ${proposal.reasoning}`);
      console.log(`  Patches: ${proposal.patchCount}`);
    }
  }

  // ── Private ───────────────────────────────────────────

  private pushItem(item: StaticItem): void {
    this.updateState(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));
  }

  private updateState(fn: (prev: AppState) => AppState): void {
    if (this.setStateRef.current) {
      this.setStateRef.current(fn);
    } else {
      this.stateRef.current = fn(this.stateRef.current);
    }
  }

  private updateDashboardFromEvent(
    dashboard: SwarmDashboardState | null,
    event: SwarmEvent,
  ): SwarmDashboardState {
    const d = dashboard ?? {
      totalAgents: 0,
      convergence: 0,
      files: [],
      recentEvents: [],
      startTime: Date.now(),
      skillsLoaded: 0,
    };

    switch (event.type) {
      case 'agent_spawned':
        return { ...d, totalAgents: event.total };
      case 'convergence_update':
        return {
          ...d,
          convergence: event.percentage,
          files: event.fileStatuses.length > 0 ? event.fileStatuses : d.files,
        };
      case 'skill_loaded':
        return { ...d, skillsLoaded: d.skillsLoaded + 1 };
      default:
        return d;
    }
  }
}
