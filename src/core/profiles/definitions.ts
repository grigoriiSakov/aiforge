import type { ProfileDefinition, ProjectProfileId } from "../types.js";

export const PROFILE_DEFINITIONS: Record<ProjectProfileId, ProfileDefinition> = {
  "python-fastapi-docker": {
    id: "python-fastapi-docker",
    label: "Python + FastAPI + Docker",
    detectionHints: ["pyproject.toml", "uv.lock", "alembic", "fastapi", "docker-compose.yml"],
    taskCommands: {
      build: ["echo \"No dedicated build step for FastAPI profile\""],
      test: ["cd ../docker && docker compose exec app uv run python scripts/run_pytest_isolated.py -v"],
      lint: ["cd ../docker && docker compose exec app uv run ruff check ."],
      verify: [
        "python3 scripts/check_import_boundaries.py",
        "task lint",
        "task test"
      ],
      review: ["task verify", "echo \"Review evidence collected. Record final verdict via review-state.mjs.\""]
    },
    trackerDefault: "linear",
    languageDefault: "ru",
    linearDefaults: {
      enabled: true,
      scopes: [
        {
          teamId: null,
          team: "Backend Team",
          projectId: null,
          project: null,
          defaultLabels: ["backend"]
        }
      ]
    },
    manifestoTitle: "Modular Backend Manifesto",
    llmsSourceGlobs: ["src/**/*.py", ".cursor/**/*.md", ".cursor/**/*.mdc", "AGENTS.md", "MANIFESTO.md"],
    notes: ["Assumes docker-first validation", "Designed for modular FastAPI projects."]
  },
  "laravel-docker": {
    id: "laravel-docker",
    label: "Laravel + Docker",
    detectionHints: ["composer.json", "artisan", "bootstrap/app.php", "laravel/framework"],
    taskCommands: {
      build: ["echo \"No standalone build step for Laravel profile\""],
      test: ["docker compose exec php php artisan test --compact"],
      lint: [
        "docker compose exec php vendor/bin/pint --dirty --format=agent",
        "docker compose exec php vendor/bin/phpstan analyse"
      ],
      verify: ["task lint", "task test"],
      review: ["task verify", "echo \"Review evidence collected. Record final verdict via review-state.mjs.\""]
    },
    trackerDefault: "gitlab",
    languageDefault: "ru",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Backend Team",
          projectId: null,
          project: null,
          defaultLabels: ["backend"]
        }
      ]
    },
    manifestoTitle: "Laravel Domain Workflow Manifesto",
    llmsSourceGlobs: ["app/**/*.php", ".cursor/**/*.md", ".cursor/**/*.mdc", "AGENTS.md", "MANIFESTO.md"],
    notes: ["Assumes commands run inside Docker container.", "Optimized for DDD-ish Laravel layout."]
  },
  "vue-quasar-capacitor": {
    id: "vue-quasar-capacitor",
    label: "Vue + Quasar + Capacitor",
    detectionHints: ["quasar", "capacitor", "vite", "yarn.lock", "package.json"],
    taskCommands: {
      build: ["yarn build"],
      test: ["yarn test"],
      lint: ["yarn typecheck:ci"],
      verify: ["yarn gate:prepush"],
      review: ["task verify", "echo \"Review evidence collected. Record final verdict via review-state.mjs.\""]
    },
    trackerDefault: "linear",
    languageDefault: "ru",
    linearDefaults: {
      enabled: true,
      scopes: [
        {
          teamId: null,
          team: "Frontend Team",
          projectId: null,
          project: null,
          defaultLabels: ["frontend"]
        }
      ]
    },
    manifestoTitle: "Frontend App Workflow Manifesto",
    llmsSourceGlobs: ["src/**/*.{ts,tsx,js,vue}", ".cursor/**/*.md", ".cursor/**/*.mdc", "AGENTS.md", "MANIFESTO.md"],
    notes: ["Uses gate-first verification.", "Works for Vue/Quasar/Capacitor style repos."]
  }
};

export function getProfileDefinition(profileId: ProjectProfileId): ProfileDefinition {
  return PROFILE_DEFINITIONS[profileId];
}
