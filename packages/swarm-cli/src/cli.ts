#!/usr/bin/env node
/**
 * Tyranids CLI - Interactive swarm intelligence command-line tool
 *
 * Single Agent responds to simple requests.
 * Complex tasks trigger swarm scaling with real-time visualization.
 */

import { getModel, type Model, type Api } from '@mariozechner/pi-ai';
import { TyranidWorkspace } from './workspace.js';
import { SkillLibrary } from './skill-library.js';
import { SelfEvolution } from './self-evolution.js';
import { Gatekeeper } from './gatekeeper.js';
import { HiveMind } from './hive-mind.js';
import { TerminalUI } from './terminal-ui.js';  // compiled from terminal-ui.tsx

// ── Argument parsing ─────────────────────────────────

interface CLIArgs {
  init: boolean;
  provider?: string;
  model?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { init: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--init':
      case '-i':
        args.init = true;
        break;
      case '--provider':
      case '-p':
        args.provider = argv[++i];
        break;
      case '--model':
      case '-m':
        args.model = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
  Tyranids - Swarm Intelligence CLI

  Usage: tyranids [options]

  Options:
    --init, -i          Initialize workspace in current directory
    --provider, -p      LLM provider (default: from config)
    --model, -m         Model name (default: from config)
    --help, -h          Show this help message

  Commands (interactive):
    /status             Show workspace status
    /skills             List learned skills
    /history            Show task history
    /evolve             Trigger self-evolution
    /clear              Clear conversation
    /quit, /exit        Exit Tyranids
  `);
}

// ── Main ─────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 1. Discover or initialize workspace (mutable — can upgrade global→project mid-session)
  let workspace = args.init
    ? await TyranidWorkspace.initialize(process.cwd())
    : await TyranidWorkspace.discover(process.cwd());

  // 2. Read global configuration
  const globalConfig = await TyranidWorkspace.readGlobalConfig();
  const provider = args.provider ?? globalConfig.provider;
  const modelName = args.model ?? globalConfig.modelName;

  // 3. Create model (fix Minimax baseUrl if needed)
  let model: Model<Api>;
  try {
    model = getModel(provider as any, modelName as any) as Model<Api>;
    if (provider === 'minimax' && model.baseUrl?.includes('minimax.io')) {
      model = { ...model, baseUrl: 'https://api.minimaxi.com/anthropic' };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to create model (${provider}/${modelName}): ${msg}`);
    process.exit(1);
  }

  // 4. Initialize subsystems & session state
  const skillLibrary = new SkillLibrary(workspace);
  const selfEvolution = new SelfEvolution(workspace, model);
  const state: SessionState = {
    workspace,
    skillLibrary,
    selfEvolution,
    ui: new TerminalUI(),
    hiveMind: null as any, // initialized below
    gatekeeper: new Gatekeeper(skillLibrary, model),
    provider,
    modelName,
  };
  state.hiveMind = new HiveMind(state.workspace, state.skillLibrary, state.selfEvolution);

  // 5. Connect event stream
  state.hiveMind.onSwarmEvent(event => state.ui.pushEvent(event));

  // 6. Register input handler BEFORE starting UI (pipe input may arrive immediately)
  state.ui.onInput(async (input) => {
    // Handle commands
    if (input.startsWith('/')) {
      await handleCommand(input, state);
      return;
    }

    // Handle normal input through gatekeeper
    state.ui.setProcessing(true);

    try {
      const response = await state.gatekeeper.handleMessage(input);

      if (response.type === 'simple') {
        state.ui.setProcessing(false);
        state.ui.printAssistantMessage(response.text);
      } else {
        // Complex task — requires project workspace
        if (!state.workspace.hasProject()) {
          state.ui.setProcessing(false);
          const yes = await state.ui.confirm(
            `Swarm tasks need a project workspace. Initialize in ${process.cwd()}?`
          );
          if (!yes) {
            state.ui.printSystemMessage('Cancelled. Use /init to initialize manually.');
            state.ui.renderPrompt();
            return;
          }
          state.workspace = await TyranidWorkspace.initialize(process.cwd());
          state.hiveMind = new HiveMind(state.workspace, state.skillLibrary, state.selfEvolution);
          state.hiveMind.onSwarmEvent(event => state.ui.pushEvent(event));
          state.ui.printSystemMessage(`Workspace initialized: ${state.workspace.workspaceDir}`);
        }

        // Switch to swarm mode
        state.ui.setProcessing(false);
        state.ui.switchToSwarm();

        const result = await state.hiveMind.executeSwarmTask(
          response.assessment,
          input,
          state.provider,
          state.modelName,
        );

        state.ui.renderTaskComplete(
          result.files,
          result.convergence,
          result.duration,
          result.skillsLearned,
        );

        if (result.files.size > 0) {
          const paths = [...result.files.keys()].join(', ');
          state.ui.printSystemMessage(`Files written to project: ${paths}`);
        }

        // Switch back to chat mode
        state.ui.switchToChat();
      }
    } catch (err: unknown) {
      state.ui.setProcessing(false);
      const msg = err instanceof Error ? err.message : String(err);
      state.ui.printSystemMessage(`Error: ${msg}`);
      state.ui.renderPrompt();
    }
  });

  // 7. Start UI (after input handler is registered)
  state.ui.start();
  const info = await state.workspace.readWorkspaceInfo();
  state.ui.renderHeader(info);
  state.ui.printSystemMessage(`Provider: ${state.provider} / ${state.modelName}`);
  if (state.workspace.isGlobal) {
    state.ui.printSystemMessage('Mode: global (chat only, use /init for full swarm)');
  }
}

// ── Command Handler ──────────────────────────────────

/** Mutable session state — workspace/hiveMind can be upgraded mid-session via /init */
interface SessionState {
  workspace: TyranidWorkspace;
  skillLibrary: SkillLibrary;
  selfEvolution: SelfEvolution;
  hiveMind: HiveMind;
  gatekeeper: Gatekeeper;
  ui: TerminalUI;
  provider: string;
  modelName: string;
}

async function handleCommand(input: string, ctx: SessionState): Promise<void> {
  const cmd = input.split(/\s+/)[0].toLowerCase();

  switch (cmd) {
    case '/quit':
    case '/exit':
      ctx.ui.printSystemMessage('Goodbye.');
      ctx.ui.stop();
      process.exit(0);
      break;

    case '/status': {
      const info = await ctx.workspace.readWorkspaceInfo();
      ctx.ui.renderWorkspaceStatus(info);
      ctx.ui.renderPrompt();
      break;
    }

    case '/skills': {
      const skills = await ctx.skillLibrary.listSkills();
      ctx.ui.renderSkillsList(skills);
      ctx.ui.renderPrompt();
      break;
    }

    case '/history': {
      const history = await ctx.workspace.getTaskHistory();
      if (history.length === 0) {
        ctx.ui.printSystemMessage('No task history.');
      } else {
        const lines = history.map(t => {
          const status = t.status === 'completed' ? '\u2713' : t.status === 'failed' ? '\u2717' : '\u27F3';
          const conv = t.convergence !== undefined ? ` (${(t.convergence * 100).toFixed(0)}%)` : '';
          return `${status} ${t.id}: ${t.description.slice(0, 60)}${conv}`;
        });
        ctx.ui.printSystemMessage(`Task History:\n${lines.join('\n')}`);
      }
      ctx.ui.renderPrompt();
      break;
    }

    case '/evolve': {
      ctx.ui.switchToEvolution();
      ctx.ui.printSystemMessage('Analyzing swarm source code for evolution opportunities...');
      ctx.ui.setProcessing(true);

      try {
        const proposal = await ctx.selfEvolution.analyzeAndPropose(
          'User-requested evolution analysis'
        );
        ctx.ui.setProcessing(false);

        if (proposal.patches.length === 0) {
          ctx.ui.printSystemMessage('No evolution opportunities found.');
        } else {
          ctx.ui.renderEvolutionProposal({
            description: proposal.description,
            estimatedImpact: proposal.estimatedImpact,
            reasoning: proposal.reasoning,
            patchCount: proposal.patches.length,
          });
          ctx.ui.printSystemMessage(
            'To apply this evolution, implement approval flow (coming soon).'
          );
        }
      } catch (err: unknown) {
        ctx.ui.setProcessing(false);
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.printSystemMessage(`Evolution error: ${msg}`);
      }

      ctx.ui.switchToChat();
      break;
    }

    case '/init': {
      if (ctx.workspace.hasProject()) {
        ctx.ui.printSystemMessage(`Project workspace already exists: ${ctx.workspace.workspaceDir}`);
      } else {
        const cwd = process.cwd();
        const yes = await ctx.ui.confirm(`Initialize project workspace in ${cwd}?`);
        if (yes) {
          ctx.workspace = await TyranidWorkspace.initialize(cwd);
          ctx.hiveMind = new HiveMind(ctx.workspace, ctx.skillLibrary, ctx.selfEvolution);
          ctx.hiveMind.onSwarmEvent(event => ctx.ui.pushEvent(event));
          ctx.ui.printSystemMessage(`Workspace initialized: ${ctx.workspace.workspaceDir}`);
        } else {
          ctx.ui.printSystemMessage('Cancelled.');
        }
      }
      ctx.ui.renderPrompt();
      break;
    }

    case '/clear': {
      ctx.gatekeeper.clearHistory();
      ctx.ui.printSystemMessage('Conversation cleared.');
      ctx.ui.renderPrompt();
      break;
    }

    default:
      ctx.ui.printSystemMessage(
        `Unknown command: ${cmd}. Available: /status, /skills, /history, /init, /evolve, /clear, /quit`
      );
      ctx.ui.renderPrompt();
  }
}

// ── Entry Point ──────────────────────────────────────

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
