# Profiles

A profile is a set of practical defaults for a project stack: detection hints, starter task commands, tracker defaults, manifesto title, and source globs for LLM context.

Supported profiles:

| Profile | Best for |
|---------|----------|
| `python-fastapi-docker` | Docker-first FastAPI backends |
| `python-django` | Conventional Django apps and APIs |
| `laravel-docker` | Laravel applications validated inside Docker |
| `node-express-api` | Node.js HTTP APIs using npm scripts |
| `nextjs` | Next.js product applications |
| `react-vite` | React frontends powered by Vite |
| `vue-quasar-capacitor` | Vue/Quasar/Capacitor apps |
| `go-service` | Go services using the standard Go toolchain |

Profiles are starting points. After `init` or `adopt`, edit `ai.config.yaml` when a repository has different lint, test, build, or tracker conventions.
