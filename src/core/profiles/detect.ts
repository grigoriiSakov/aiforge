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
  const facts: string[] = [];
  const scores: DetectionScore[] = [
    { profile: "python-fastapi-docker", score: 0, reasons: [] },
    { profile: "laravel-docker", score: 0, reasons: [] },
    { profile: "vue-quasar-capacitor", score: 0, reasons: [] }
  ];

  const packageJson = readTextFileIfExists(packageJsonPath);
  const composerJson = readTextFileIfExists(composerJsonPath);
  const pyproject = readTextFileIfExists(pyprojectPath);
  const gitlabCi = readTextFileIfExists(path.join(repoRoot, ".gitlab-ci.yml"));
  const agents = readTextFileIfExists(path.join(repoRoot, "AGENTS.md"));

  if (packageJson) {
    facts.push("Found package.json");
    if (/quasar/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 4, "package.json mentions Quasar");
    }
    if (/capacitor/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 3, "package.json mentions Capacitor");
    }
    if (/vite/i.test(packageJson)) {
      addScore(scores, "vue-quasar-capacitor", 2, "package.json mentions Vite");
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
    if (/ruff/i.test(pyproject) || /pytest/i.test(pyproject)) {
      addScore(scores, "python-fastapi-docker", 2, "pyproject.toml mentions Ruff/Pytest");
    }
  }

  if (fs.existsSync(path.join(repoRoot, "artisan"))) {
    facts.push("Found artisan");
    addScore(scores, "laravel-docker", 4, "artisan entrypoint exists");
  }

  if (fs.existsSync(path.join(repoRoot, "uv.lock")) || fs.existsSync(path.join(repoRoot, "alembic.ini"))) {
    facts.push("Found Python project lock/migration file");
    addScore(scores, "python-fastapi-docker", 3, "uv.lock or alembic.ini exists");
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

  if (agents && /laravel|artisan|composer|pint|phpstan/i.test(agents)) {
    facts.push("AGENTS.md looks Laravel-oriented");
    addScore(scores, "laravel-docker", 2, "AGENTS.md mentions Laravel workflow");
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
