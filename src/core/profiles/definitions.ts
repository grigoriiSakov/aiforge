import { TASK_COMMAND_PLACEHOLDER } from "../task-runner.js";
import type { ProfileDefinition, ProjectProfileId } from "../types.js";

export const PROFILE_DEFINITIONS: Record<ProjectProfileId, ProfileDefinition> = {
  "python-fastapi-docker": {
    id: "python-fastapi-docker",
    label: "Python + FastAPI + Docker",
    detectionHints: ["pyproject.toml", "uv.lock", "alembic", "fastapi", "docker-compose.yml"],
    taskCommands: {
      implement: ["echo \"No dedicated implement step for FastAPI profile\""],
      test: ["cd ../docker && docker compose exec app uv run python scripts/run_pytest_isolated.py -v"],
      testScoped: ["cd ../docker && docker compose exec app uv run python scripts/run_pytest_isolated.py -v {{.CLI_ARGS}}"],
      lint: ["cd ../docker && docker compose exec app uv run ruff check ."],
      lintScoped: ["cd ../docker && docker compose exec app uv run ruff check {{.CLI_ARGS}}"],
      verify: [
        "python3 scripts/check_import_boundaries.py",
        `${TASK_COMMAND_PLACEHOLDER} lint`,
        `${TASK_COMMAND_PLACEHOLDER} test`
      ],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
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
    llmsSourceGlobs: [
      "src/**/*.py",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Assumes docker-first validation", "Designed for modular FastAPI projects."]
  },
  "python-django": {
    id: "python-django",
    label: "Python + Django",
    detectionHints: ["manage.py", "django", "pyproject.toml", "requirements.txt"],
    taskCommands: {
      implement: ["python manage.py check"],
      test: ["python manage.py test"],
      testScoped: ["python manage.py test {{.CLI_ARGS}}"],
      lint: ["python -m ruff check ."],
      lintScoped: ["python -m ruff check {{.CLI_ARGS}}"],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
    },
    trackerDefault: "github",
    languageDefault: "en",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Backend Team",
          projectId: null,
          project: null,
          defaultLabels: ["backend", "python"]
        }
      ]
    },
    manifestoTitle: "Django Application Workflow Manifesto",
    llmsSourceGlobs: [
      "**/*.py",
      "templates/**/*.{html,jinja,jinja2}",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Defaults to manage.py validation.", "Best for conventional Django apps and APIs."]
  },
  "laravel-docker": {
    id: "laravel-docker",
    label: "Laravel + Docker",
    detectionHints: ["composer.json", "artisan", "bootstrap/app.php", "laravel/framework"],
    taskCommands: {
      implement: ["echo \"No standalone implement step for Laravel profile\""],
      test: ["docker compose exec php php artisan test --compact"],
      testScoped: ["docker compose exec php php artisan test --compact {{.CLI_ARGS}}"],
      lint: [
        "docker compose exec php vendor/bin/pint --dirty --format=agent",
        "docker compose exec php vendor/bin/phpstan analyse"
      ],
      lintScoped: [
        "docker compose exec php vendor/bin/pint --test --format=agent {{.CLI_ARGS}}",
        "docker compose exec php vendor/bin/phpstan analyse {{.CLI_ARGS}}"
      ],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
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
    llmsSourceGlobs: [
      "app/**/*.php",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Assumes commands run inside Docker container.", "Optimized for DDD-ish Laravel layout."]
  },
  "node-express-api": {
    id: "node-express-api",
    label: "Node.js + Express API",
    detectionHints: ["package.json", "express", "tsconfig.json", "src/server.ts"],
    taskCommands: {
      implement: ["npm run build --if-present"],
      test: ["npm run test --if-present"],
      testScoped: ["npm run test --if-present -- {{.CLI_ARGS}}"],
      lint: ["npm run lint --if-present", "npm run typecheck --if-present"],
      lintScoped: ["npm run lint --if-present -- {{.CLI_ARGS}}"],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
    },
    trackerDefault: "github",
    languageDefault: "en",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Backend Team",
          projectId: null,
          project: null,
          defaultLabels: ["backend", "node"]
        }
      ]
    },
    manifestoTitle: "Node API Workflow Manifesto",
    llmsSourceGlobs: [
      "src/**/*.{ts,tsx,js,mjs,cjs}",
      "test/**/*.{ts,tsx,js,mjs,cjs}",
      "tests/**/*.{ts,tsx,js,mjs,cjs}",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Uses npm script conventions.", "Good default for Express/Fastify-style APIs."]
  },
  "nextjs": {
    id: "nextjs",
    label: "Next.js",
    detectionHints: ["next", "app/", "pages/", "next.config.js", "next.config.ts"],
    taskCommands: {
      implement: ["npm run build --if-present"],
      test: ["npm run test --if-present"],
      testScoped: ["npm run test --if-present -- {{.CLI_ARGS}}"],
      lint: ["npm run lint --if-present", "npm run typecheck --if-present"],
      lintScoped: ["npm run lint --if-present -- {{.CLI_ARGS}}"],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
    },
    trackerDefault: "github",
    languageDefault: "en",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Product Engineering",
          projectId: null,
          project: null,
          defaultLabels: ["frontend", "nextjs"]
        }
      ]
    },
    manifestoTitle: "Next.js Product Workflow Manifesto",
    llmsSourceGlobs: [
      "app/**/*.{ts,tsx,js,jsx,mdx}",
      "pages/**/*.{ts,tsx,js,jsx,mdx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "src/**/*.{ts,tsx,js,jsx}",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Uses npm script conventions.", "Covers App Router and Pages Router projects."]
  },
  "react-vite": {
    id: "react-vite",
    label: "React + Vite",
    detectionHints: ["react", "vite", "package.json", "index.html"],
    taskCommands: {
      implement: ["npm run build --if-present"],
      test: ["npm run test --if-present"],
      testScoped: ["npm run test --if-present -- {{.CLI_ARGS}}"],
      lint: ["npm run lint --if-present", "npm run typecheck --if-present"],
      lintScoped: ["npm run lint --if-present -- {{.CLI_ARGS}}"],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
    },
    trackerDefault: "github",
    languageDefault: "en",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Frontend Team",
          projectId: null,
          project: null,
          defaultLabels: ["frontend", "react"]
        }
      ]
    },
    manifestoTitle: "React Frontend Workflow Manifesto",
    llmsSourceGlobs: [
      "src/**/*.{ts,tsx,js,jsx,css,scss}",
      "public/**/*",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Uses npm script conventions.", "Good default for Vite-powered React apps."]
  },
  "vue-quasar-capacitor": {
    id: "vue-quasar-capacitor",
    label: "Vue + Quasar + Capacitor",
    detectionHints: ["quasar", "capacitor", "vite", "yarn.lock", "package.json"],
    taskCommands: {
      implement: ["yarn build"],
      test: ["yarn test"],
      testScoped: ["yarn test {{.CLI_ARGS}}"],
      lint: ["yarn typecheck:ci"],
      lintScoped: ["yarn lint {{.CLI_ARGS}}"],
      verify: ["yarn gate:prepush"],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
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
    llmsSourceGlobs: [
      "src/**/*.{ts,tsx,js,vue}",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Uses gate-first verification.", "Works for Vue/Quasar/Capacitor style repos."]
  },
  "go-service": {
    id: "go-service",
    label: "Go Service",
    detectionHints: ["go.mod", "cmd/", "internal/", "go test ./..."],
    taskCommands: {
      implement: ["go test ./..."],
      test: ["go test ./..."],
      testScoped: ["go test {{.CLI_ARGS}}"],
      lint: ["test -z \"$(gofmt -l .)\"", "go vet ./..."],
      lintScoped: ["go vet {{.CLI_ARGS}}"],
      verify: [`${TASK_COMMAND_PLACEHOLDER} lint`, `${TASK_COMMAND_PLACEHOLDER} test`],
      review: ['echo "Review evidence collected. Record final verdict via review-state.mjs."']
    },
    trackerDefault: "github",
    languageDefault: "en",
    linearDefaults: {
      enabled: false,
      scopes: [
        {
          teamId: null,
          team: "Platform Team",
          projectId: null,
          project: null,
          defaultLabels: ["backend", "go"]
        }
      ]
    },
    manifestoTitle: "Go Service Workflow Manifesto",
    llmsSourceGlobs: [
      "**/*.go",
      "go.mod",
      "go.sum",
      ".cursor/**/*.md",
      ".cursor/**/*.mdc",
      ".claude/**/*.md",
      ".claude/**/*.json",
      "AGENTS.md",
      "MANIFESTO.md"
    ],
    notes: ["Uses the Go toolchain directly.", "Good default for services with cmd/internal layout."]
  }
};

export function getProfileDefinition(profileId: ProjectProfileId): ProfileDefinition {
  return PROFILE_DEFINITIONS[profileId];
}
