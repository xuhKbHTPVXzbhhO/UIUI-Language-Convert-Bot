import { logger } from "../lib/logger";
import { startDiscordBot } from "./bot";

if (!process.env.DISCORD_TOKEN) {
  logger.error(
    "DISCORD_TOKEN is required for the Discord worker; add it to the Render service environment",
  );
  process.exit(1);
}

startDiscordBot();