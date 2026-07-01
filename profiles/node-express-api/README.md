# node-express-api

Designed for Node.js HTTP APIs that expose their workflow through npm scripts.

Default assumptions:

- `npm run build --if-present`
- `npm run test --if-present`
- `npm run lint --if-present`
- `npm run typecheck --if-present`

Use this profile for Express, Fastify, and similar API services. Keep project-specific commands in `ai.config.yaml` when the repository uses pnpm, yarn, Docker, or a custom test runner.
