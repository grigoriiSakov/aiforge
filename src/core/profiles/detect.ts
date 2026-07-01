import fs from "node:fs";
import path from "node:path";

import { readTextFileIfExists } from "../filesystem.js";
import type { DetectionResult, ProjectProfileId } from "../types.js";

interface DetectionScore {
  profile: ProjectProfileId;
  score: number;
  reasons: string[];
}

export function detectProfile(repoRoot: string): DetectionResult {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const composerJsonPath = path.join(repoRoot, "composer.json");
  const pyprojectPath = path.join(repoRoot, "pyproject.toml");
  const requirementsPath = path.join(repoRoot, "requirements.txt");
  const goModPath = path.join(repoRoot, "go.mod");
  const facts: string[] = [];
  const scores: DetectionScore[] = [
    { profile: "python-fastapi-docker", score: 0, reasons: [] },
    { profile: "python-django", score: 0, reasons: [] },
    { profile: "laravel-docker", score: 0, reasons: [] },
    { profile: "node-express-api", score: 0, reasons: [] },
    { profile: "nextjs", score: 0, reasons: [] },
    { profile: "react-vite", score: 0, reasons: [] },
    { profile: "vue-quasar-capacitor", score: 0, reasons: [] },
    { profile: "go-service", score: 0, reasons: [] }
  ];

  const packageJson = readTextFileIfExists(packageJsonPath);
  const composerJson = readTextFileIfExists(composerJsonPath);
  const pyproject = readTextFileIfExists(pyprojectPath);
  const requirements = readTextFileIfExists(requirementsPath);
  const goMod = readTextFileIfExists(goModPath);
  const gitlabCi = readTextFileIfExists(path.join(repoRoot, ".gitlab-ci.yml"));
  const agents = readTextFileIfExists(path.join(repoRoot, "AGENTS.md"));

  if (packageJson) {
    facts.push("Found package.json");
    if (/"next"\s*:/i.test(packageJson) || /next\/(app|document|router)/i.test(packageJson)) {
      addScore(scores, "nextjs", 6, "package.json mentions Next.js");
    }
    if (/"react"\s*:/i.test(packageJson)) {
      addScore(scores, "react-vite", 3, "package.json mentions React");
    }
    if (/"express"\s*:/i.test(packageJson)) {
      addScore(scores, "node-express-api", 5, "package.json mentions Express");
    }
    if (/quasar/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 4, "package.json mentions Quasar");
    }
    if (/capacitor/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 3, "package.json mentions Capacitor");
    }
    if (/vite/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 2, "package.json mentions Vite");
      addScore(scores, "react-vite", 3, "package.json mentions Vite");
    }
  }

  if (composerJson) {
    facts.push("Found composer.json");
    if (/laravel\/framework/i.test(composerJson)) {
      addScore(scores, "laravel-docker", 5, "composer.json mentions laravel/framework");
    }
  }

  if (pyproject) {
    facts.push("Found pyproject.toml");
    if (/fastapi/i.test(pyproject)) {
      addScore(scores, "python-fastapi-docker", 5, "pyproject.toml mentions FastAPI");
    }
    if (/django/i.test(pyproject)) {
      addScore(scores, "python-django", 5, "pyproject.toml mentions Django");
    }
    if (/ruff/i.test(pyproject) || /pytest/i.test(pyproject)) {
      addScore(scores, "python-fastapi-docker", 2, "pyproject.toml mentions Ruff/Pytest");
    }
  }

  if (requirements) {
    facts.push("Found requirements.txt");
    if (/django/i.test(requirements)) {
      addScore(scores, "python-django", 5, "requirements.txt mentions Django");
    }
  }

  if (goMod) {
    facts.push("Found go.mod");
    addScore(scores, "go-service", 5, "go.mod exists");
    if (/module\s+\S+/i.test(goMod)) {
      addScore(scores, "go-service", 2, "go.mod has module declaration");
    }
  }

  if (fs.existsSync(path.join(repoRoot, "artisan"))) {
    facts.push("Found artisan");
    addScore(scores, "laravel-docker", 4, "artisan entrypoint exists");
  }

  if (fs.existsSync(path.join(repoRoot, "manage.py"))) {
    facts.push("Found manage.py");
    addScore(scores, "python-django", 4, "manage.py exists");
  }

  if (fs.existsSync(path.join(repoRoot, "uv.lock")) || fs.existsSync(path.join(repoRoot, "alembic.ini"))) {
    facts.push("Found Python project lock/migration file");
    addScore(scores, "python-fastapi-docker", 3, "uv.lock or alembic.ini exists");
  }

  if (fs.existsSync(path.join(repoRoot, "next.config.js")) || fs.existsSync(path.join(repoRoot, "next.config.ts"))) {
    facts.push("Found Next.js config");
    addScore(scores, "nextjs", 4, "Next.js config exists");
  }

  if (fs.existsSync(path.join(repoRoot, "index.html"))) {
    facts.push("Found index.html");
    addScore(scores, "react-vite", 1, "index.html exists");
  }

  if (fs.existsSync(path.join(repoRoot, "tsconfig.json")) && packageJson && /"express"\s*:/i.test(packageJson)) {
    facts.push("Found TypeScript Node API hints");
    addScore(scores, "node-express-api", 2, "tsconfig.json exists with Express dependency");
  }

  if (fs.existsSync(path.join(repoRoot, "yarn.lock"))) {
    facts.push("Found yarn.lock");
    addScore(scores, "vue-quasar-capacitor", 1, "yarn.lock exists");
  }

  if (gitlabCi && /docker compose exec php/i.test(gitlabCi)) {
    facts.push("CI mentions docker compose exec php");
    addScore(scores, "laravel-docker", 2, "CI uses php docker service");
  }

  if (gitlabCi && /yarn gate:prepush/i.test(gitlabCi)) {
    facts.push("CI mentions yarn gate:prepush");
    addScore(scores, "vue-quasar-capacitor", 3, "CI uses yarn gate:prepush");
  }

  if (agents && /fastapi|uv run|pytest|ruff/i.test(agents)) {
    facts.push("AGENTS.md looks Python/FastAPI-oriented");
    addScore(scores, "python-fastapi-docker", 2, "AGENTS.md mentions Python/FastAPI workflow");
  }

  if (agents && /django|manage\.py/i.test(agents)) {
    facts.push("AGENTS.md looks Django-oriented");
    addScore(scores, "python-django", 2, "AGENTS.md mentions Django workflow");
  }

  if (agents && /laravel|artisan|composer|pint|phpstan/i.test(agents)) {
    facts.push("AGENTS.md looks Laravel-oriented");
    addScore(scores, "laravel-docker", 2, "AGENTS.md mentions Laravel workflow");
  }

  if (agents && /next\.?js|app router|pages router/i.test(agents)) {
    facts.push("AGENTS.md looks Next.js-oriented");
    addScore(scores, "nextjs", 2, "AGENTS.md mentions Next.js workflow");
  }

  if (agents && /react|vite|vitest/i.test(agents)) {
    facts.push("AGENTS.md looks React/Vite-oriented");
    addScore(scores, "react-vite", 2, "AGENTS.md mentions React/Vite workflow");
  }

  if (agents && /express|node\.?js|npm run/i.test(agents)) {
    facts.push("AGENTS.md looks Node-oriented");
    addScore(scores, "node-express-api", 2, "AGENTS.md mentions Node workflow");
  }

  if (agents && /\bgo test\b|golang|go service/i.test(agents)) {
    facts.push("AGENTS.md looks Go-oriented");
    addScore(scores, "go-service", 2, "AGENTS.md mentions Go workflow");
  }

  if (agents && /quasar|capacitor|yarn|vite/i.test(agents)) {
    facts.push("AGENTS.md looks frontend-oriented");
    addScore(scores, "vue-quasar-capacitor", 2, "AGENTS.md mentions Quasar/Capacitor/Vite");
  }

  const best = scores.sort((left, right) => right.score - left.score)[0];
  if (!best) {
    throw new Error("Profile detection failed: no scores computed");
  }
  const confidence = best.score >= 7 ? "high" : best.score >= 4 ? "medium" : "low";
  const reasons = best.reasons.length > 0 ? best.reasons : ["No strong profile match detected automatically."];

  return {
    recommendedProfile: best.profile,
    confidence,
    score: best.score,
    reasons,
    facts
  };
}

function addScore(scores: DetectionScore[], profile: ProjectProfileId, delta: number, reason: string): void {
  const target = scores.find((entry) => entry.profile === profile);
  if (!target) {
    return;
  }

  target.score += delta;
  target.reasons.push(reason);
}
