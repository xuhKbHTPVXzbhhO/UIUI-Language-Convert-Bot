# ういうい語 Discord Bot

Discord bot that decodes 「う」「い」 language and can encode ordinary text back into it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Automatically decodes valid ういうい語 messages.
- `!encode <文章>` converts ordinary text into ういうい語.
- `!decode <ういうい語>` explicitly decodes a supplied value.
- `!help` shows the available commands.
- Long Discord replies are split safely under Discord's message limit.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `DISCORD_TOKEN` is stored as a Replit Secret and is required to connect the bot.
- Discord Developer Portal must have **Message Content Intent** enabled for the bot.
- The bot needs View Channels, Send Messages, and Read Message History permissions.
- After enabling the privileged intent, restart the API Server workflow.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
