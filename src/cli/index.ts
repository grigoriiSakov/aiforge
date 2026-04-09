#!/usr/bin/env node

import process from "node:process";

import { Command } from "commander";

import { runAdoptCommand } from "../commands/adopt.js";
import { runDetectCommand } from "../commands/detect.js";
import { runDoctorCommand } from "../commands/doctor.js";
import { runInitCommand } from "../commands/init.js";
import {
  runInitiativeSupervisorAbortCommand,
  runInitiativeSupervisorInitCommand,
  runInitiativeSupervisorNextCommand,
  runInitiativeSupervisorPauseCommand,
  runInitiativeSupervisorResumeCommand,
  runInitiativeSupervisorStartCommand,
  runInitiativeSupervisorStatusCommand
} from "../commands/initiative-supervisor.js";
import { runLinearInitCommand } from "../commands/linear-init.js";
import { runLinearScopeSetCommand } from "../commands/linear-scope-set.js";
import { runLlmsBuildCommand } from "../commands/llms-build.js";
import { runManifestoInitCommand } from "../commands/manifesto-init.js";
import { runMcpScaffoldCommand } from "../commands/mcp-scaffold.js";
import { runProjectStubCommand } from "../commands/project-stub.js";
import { runSyncCommand } from "../commands/sync.js";
import { runUpdateCommand } from "../commands/update.js";
import { printResult } from "../core/output.js";
import type { ProjectProfileId } from "../core/types.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("aiforge")
    .description("MVP CLI configurator for managed AI surfaces")
    .version("0.1.0");

  program
    .command("detect")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; json: boolean }) => {
      const result = runDetectCommand(options.repo);
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("init")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--project-name <name>", "Human-readable project name")
    .option("--profile <id>", "Profile id")
    .option("--yes", "Apply without interactive confirmation", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: {
      repo: string;
      projectName?: string;
      profile?: string;
      dryRun: boolean;
      json: boolean;
    }) => {
      const initOptions: {
        repoRoot: string;
        projectName?: string;
        profileId?: ProjectProfileId;
        dryRun: boolean;
      } = {
        repoRoot: options.repo,
        dryRun: options.dryRun
      };

      if (options.projectName) {
        initOptions.projectName = options.projectName;
      }

      if (options.profile) {
        initOptions.profileId = options.profile as ProjectProfileId;
      }

      const result = await runInitCommand(initOptions);
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("adopt")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--profile <id>", "Profile id")
    .option("--yes", "Apply without interactive confirmation", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: {
      repo: string;
      profile?: string;
      dryRun: boolean;
      json: boolean;
    }) => {
      const adoptOptions: {
        repoRoot: string;
        profileId?: ProjectProfileId;
        dryRun: boolean;
      } = {
        repoRoot: options.repo,
        dryRun: options.dryRun
      };

      if (options.profile) {
        adoptOptions.profileId = options.profile as ProjectProfileId;
      }

      const result = await runAdoptCommand(adoptOptions);
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("sync")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--profile <id>", "Override profile id")
    .option("--yes", "Apply without interactive confirmation", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: { repo: string; profile?: string; dryRun: boolean; json: boolean }) => {
      const result = await runSyncCommand(
        options.repo,
        options.dryRun,
        options.profile as ProjectProfileId | undefined
      );
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("update")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--profile <id>", "Override profile id before update")
    .option("--yes", "Apply without interactive confirmation", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: { repo: string; profile?: string; dryRun: boolean; json: boolean }) => {
      const result = await runUpdateCommand(
        options.repo,
        options.dryRun,
        options.profile as ProjectProfileId | undefined
      );
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("doctor")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; json: boolean }) => {
      const result = runDoctorCommand(options.repo);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const initiativeSupervisor = program.command("initiative-supervisor").description("Initiative supervisor runtime");
  initiativeSupervisor
    .command("init")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--manifest <path>", "Path to issues-manifest.json")
    .option("--project <name>", "Tracker project name")
    .option("--project-id <id>", "Tracker project id")
    .option("--tracker <name>", "Tracker type override for project metadata")
    .option("--base-branch <name>", "Base branch for the initiative manager branch")
    .option("--manager-branch <name>", "Manager branch name")
    .option("--max-attempts <count>", "Max worker attempts per issue")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action(
      (options: {
        slug: string;
        manifest?: string;
        project?: string;
        projectId?: string;
        tracker?: string;
        baseBranch?: string;
        managerBranch?: string;
        maxAttempts?: string;
        repo: string;
        json: boolean;
      }) => {
        const parsedMaxAttempts =
          options.maxAttempts !== undefined ? Number.parseInt(options.maxAttempts, 10) : undefined;
        const hasMaxAttempts = typeof parsedMaxAttempts === "number" && Number.isFinite(parsedMaxAttempts);
        const result = runInitiativeSupervisorInitCommand(options.repo, {
          slug: options.slug,
          ...(options.manifest ? { manifest: options.manifest } : {}),
          ...(options.project ? { project: options.project } : {}),
          ...(options.projectId ? { projectId: options.projectId } : {}),
          ...(options.tracker ? { tracker: options.tracker } : {}),
          ...(options.baseBranch ? { baseBranch: options.baseBranch } : {}),
          ...(options.managerBranch ? { managerBranch: options.managerBranch } : {}),
          ...(hasMaxAttempts ? { maxAttempts: parsedMaxAttempts } : {})
        });
        printResult(result, options.json);
        process.exit(result.code);
      }
    );

  initiativeSupervisor
    .command("start")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorStartCommand(options.repo, {
        slug: options.slug
      });
      printResult(result, options.json);
      process.exit(result.code);
    });

  initiativeSupervisor
    .command("status")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorStatusCommand(options.repo, options.slug);
      printResult(result, options.json);
      process.exit(result.code);
    });

  initiativeSupervisor
    .command("next")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorNextCommand(options.repo, options.slug);
      printResult(result, options.json);
      process.exit(result.code);
    });

  initiativeSupervisor
    .command("pause")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--reason <text>", "Pause reason")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; reason?: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorPauseCommand(options.repo, {
        slug: options.slug,
        ...(options.reason ? { reason: options.reason } : {})
      });
      printResult(result, options.json);
      process.exit(result.code);
    });

  initiativeSupervisor
    .command("resume")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorResumeCommand(options.repo, options.slug);
      printResult(result, options.json);
      process.exit(result.code);
    });

  initiativeSupervisor
    .command("abort")
    .requiredOption("--slug <slug>", "Initiative slug")
    .option("--reason <text>", "Abort reason")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { slug: string; reason?: string; repo: string; json: boolean }) => {
      const result = runInitiativeSupervisorAbortCommand(options.repo, {
        slug: options.slug,
        ...(options.reason ? { reason: options.reason } : {})
      });
      printResult(result, options.json);
      process.exit(result.code);
    });

  program
    .command("project-stub")
    .description("Print a project-specific customization prompt")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; json: boolean }) => {
      const result = runProjectStubCommand(options.repo);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const linear = program.command("linear").description("Linear helpers");
  linear
    .command("init")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; dryRun: boolean; json: boolean }) => {
      const result = runLinearInitCommand(options.repo, options.dryRun);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const linearScope = linear.command("scope").description("Manage Linear team/project scope");
  linearScope
    .command("set")
    .requiredOption("--team <name>", "Linear team name")
    .option("--team-id <id>", "Linear team id")
    .option("--project <name>", "Linear project name")
    .option("--project-id <id>", "Linear project id")
    .option("--label <value...>", "Default label(s)", [])
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(
      (options: {
        team: string;
        teamId?: string;
        project?: string;
        projectId?: string;
        label: string[];
        repo: string;
        dryRun: boolean;
        json: boolean;
      }) => {
        const commandOptions: {
          team: string;
          teamId?: string;
          project?: string;
          projectId?: string;
          defaultLabels: string[];
          dryRun?: boolean;
        } = {
          team: options.team,
          defaultLabels: options.label,
          dryRun: options.dryRun
        };

        if (options.teamId) {
          commandOptions.teamId = options.teamId;
        }

        if (options.project) {
          commandOptions.project = options.project;
        }

        if (options.projectId) {
          commandOptions.projectId = options.projectId;
        }

        const result = runLinearScopeSetCommand(options.repo, commandOptions);
        printResult(result, options.json);
        process.exit(result.code);
      }
    );

  const mcp = program.command("mcp").description("MCP helpers");
  mcp
    .command("scaffold")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; dryRun: boolean; json: boolean }) => {
      const result = runMcpScaffoldCommand(options.repo, options.dryRun);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const manifesto = program.command("manifesto").description("MANIFESTO helpers");
  manifesto
    .command("init")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; dryRun: boolean; json: boolean }) => {
      const result = runManifestoInitCommand(options.repo, options.dryRun);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const llms = program.command("llms").description("LLMS helpers");
  llms
    .command("build")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: { repo: string; dryRun: boolean; json: boolean }) => {
      const result = await runLlmsBuildCommand(options.repo, options.dryRun);
      printResult(result, options.json);
      process.exit(result.code);
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  if (/Config file not found|Unable to detect profile confidently/i.test(message)) {
    process.exit(2);
  }
  process.exit(4);
});
