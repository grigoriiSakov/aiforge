#!/usr/bin/env node

import process from "node:process";

import { Command } from "commander";

import { runAdoptCommand } from "../commands/adopt.js";
import { runExtensionAddCommand } from "../commands/extension-add.js";
import { runExtensionListCommand } from "../commands/extension-list.js";
import { runExtensionRemoveCommand } from "../commands/extension-remove.js";
import { runExtensionUpdateCommand } from "../commands/extension-update.js";
import { runDetectCommand } from "../commands/detect.js";
import { runDoctorCommand } from "../commands/doctor.js";
import { runInitCommand } from "../commands/init.js";
import { runLinearInitCommand } from "../commands/linear-init.js";
import { runLinearScopeSetCommand } from "../commands/linear-scope-set.js";
import { runLlmsBuildCommand } from "../commands/llms-build.js";
import { runManifestoInitCommand } from "../commands/manifesto-init.js";
import { runMcpScaffoldCommand } from "../commands/mcp-scaffold.js";
import { runProjectStubCommand } from "../commands/project-stub.js";
import { runSkillsAddGitCommand } from "../commands/skills-add.js";
import { runSkillsListCommand } from "../commands/skills-list.js";
import { runSkillsRemoveCommand } from "../commands/skills-remove.js";
import { runSyncCommand } from "../commands/sync.js";
import { runUpdateCommand } from "../commands/update.js";
import { printResult } from "../core/output.js";
import type { ProjectProfileId } from "../core/types.js";
import { AIFORGE_VERSION } from "../core/version.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("aiforge")
    .description("MVP CLI configurator for managed AI surfaces")
    .version(AIFORGE_VERSION);

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
    .option("--interactive", "Prompt for profile / project name on stdin", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: {
      repo: string;
      projectName?: string;
      profile?: string;
      dryRun: boolean;
      interactive: boolean;
      json: boolean;
    }) => {
      const initOptions: {
        repoRoot: string;
        projectName?: string;
        profileId?: ProjectProfileId;
        dryRun: boolean;
        interactive?: boolean;
      } = {
        repoRoot: options.repo,
        dryRun: options.dryRun,
        interactive: options.interactive
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
    .option("--interactive", "Prompt for profile / project name on stdin", false)
    .option("--dry-run", "Preview changes only", false)
    .option("--json", "Print JSON output", false)
    .action(async (options: {
      repo: string;
      profile?: string;
      dryRun: boolean;
      interactive: boolean;
      json: boolean;
    }) => {
      const adoptOptions: {
        repoRoot: string;
        profileId?: ProjectProfileId;
        dryRun: boolean;
        interactive?: boolean;
      } = {
        repoRoot: options.repo,
        dryRun: options.dryRun,
        interactive: options.interactive
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

  const ext = program.command("extension").description("Install local aiforge extensions (.aiforge/extensions)");
  ext
    .command("add")
    .argument("<path>", "Path to extension directory containing extension.json")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((sourcePath: string, options: { repo: string; json: boolean }) => {
      const result = runExtensionAddCommand(options.repo, sourcePath);
      printResult(result, options.json);
      process.exit(result.code);
    });
  ext
    .command("list")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; json: boolean }) => {
      const result = runExtensionListCommand(options.repo);
      printResult(result, options.json);
      process.exit(result.code);
    });
  ext
    .command("remove")
    .argument("<name>", "Extension name from manifest")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((name: string, options: { repo: string; json: boolean }) => {
      const result = runExtensionRemoveCommand(options.repo, name);
      printResult(result, options.json);
      process.exit(result.code);
    });
  ext
    .command("update")
    .argument("<name>", "Extension name")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((name: string, options: { repo: string; json: boolean }) => {
      const result = runExtensionUpdateCommand(options.repo, name);
      printResult(result, options.json);
      process.exit(result.code);
    });

  const skills = program.command("skills").description("Remote / git-backed skills under .ai/skills");
  skills
    .command("add-git")
    .requiredOption("--url <gitUrl>", "Git URL (shallow clone)")
    .requiredOption("--id <skillId>", "Destination directory name under .ai/skills")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { url: string; id: string; repo: string; json: boolean }) => {
      const result = runSkillsAddGitCommand(options.repo, String(options.url), String(options.id));
      printResult(result, options.json);
      process.exit(result.code);
    });
  skills
    .command("list")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((options: { repo: string; json: boolean }) => {
      const result = runSkillsListCommand(options.repo);
      printResult(result, options.json);
      process.exit(result.code);
    });
  skills
    .command("remove")
    .argument("<id>", "Skill id directory name")
    .option("--repo <path>", "Repository root", process.cwd())
    .option("--json", "Print JSON output", false)
    .action((id: string, options: { repo: string; json: boolean }) => {
      const result = runSkillsRemoveCommand(options.repo, id);
      printResult(result, options.json);
      process.exit(result.code);
    });

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
