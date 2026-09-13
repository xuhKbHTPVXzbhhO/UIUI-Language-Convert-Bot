import {
  Client,
  GatewayIntentBits,
  type Message,
  type MessageCreateOptions,
} from "discord.js";
import { logger } from "../lib/logger";
import { decodeFromUi, encodeToUi, isUiLanguage } from "./codec";

const MAX_MESSAGE_LENGTH = 2000;
const RESPONSE_CHUNK_LENGTH = MAX_MESSAGE_LENGTH - 100;
const COMMAND_PREFIX = "!";
const GATEWAY_WATCHDOG_INTERVAL_MS = 60_000;

function splitForDiscord(value: string): string[] {
  if (value.length <= RESPONSE_CHUNK_LENGTH) return [value];

  const chunks: string[] = [];
  let remaining = value;

  while (remaining.length > RESPONSE_CHUNK_LENGTH) {
    const breakAt = remaining.lastIndexOf(
      "\n",
      RESPONSE_CHUNK_LENGTH,
    );
    const splitAt = breakAt > 0 ? breakAt : RESPONSE_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function replyWithChunks(
  message: Message,
  header: string,
  body: string,
): Promise<void> {
  const chunks = splitForDiscord(body);
  const first: MessageCreateOptions = {
    content: header ? `${header}\n${chunks[0]}` : chunks[0],
    allowedMentions: { repliedUser: false },
  };

  await message.reply(first);

  for (const chunk of chunks.slice(1)) {
    if (!message.channel.isSendable()) {
      break;
    }

    await message.channel.send({
      content: chunk,
      allowedMentions: { repliedUser: false },
    });
  }
}

function commandArguments(content: string): {
  command: string;
  input: string;
} | null {
  if (!content.startsWith(COMMAND_PREFIX)) return null;

  const [rawCommand, ...rest] = content.slice(COMMAND_PREFIX.length).split(/\s+/);
  return {
    command: rawCommand.toLowerCase(),
    input: rest.join(" ").trim(),
  };
}

async function handleMessage(message: Message): Promise<void> {
  if (message.client.user?.id === message.author.id) return;

  const command = commandArguments(message.content);

  if (command?.command === "encode") {
    const result = encodeToUi(command.input);
    if (result.error) {
      await replyWithChunks(message, "⚠️ 変換できませんでした。", result.error);
      return;
    }

    await replyWithChunks(message, "🔐 ういうい語", result.text);
    return;
  }

  if (command?.command === "decode") {
    const result = decodeFromUi(command.input);
    if (result.error) {
      await replyWithChunks(message, "⚠️ 復号できませんでした。", result.error);
      return;
    }

    if (result.text) {
      await replyWithChunks(message, "", result.text);
    }
    return;
  }

  if (command?.command === "help") {
    await replyWithChunks(
      message,
      "📖 ういうい語 Bot",
      [
        "`!encode 文章` — 文章をういうい語に変換",
        "`!decode ういうい語` — ういうい語を原文に復号",
        "通常のういうい語メッセージは自動で復号します。",
      ].join("\n"),
    );
    return;
  }

  if (!isUiLanguage(message.content)) return;

  const result = decodeFromUi(message.content);

  if (result.error) {
    await replyWithChunks(
      message,
      "⚠️ ういうい語を復号できませんでした。",
      result.error,
    );
    return;
  }

  if (result.text) {
    await message.reply({
      content: "/skip",
      allowedMentions: { repliedUser: false },
    });
    await replyWithChunks(message, "原文", `「${result.text}」`);
  }
}

export function startDiscordBot(): void {
  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    logger.warn("DISCORD_TOKEN is not configured; Discord bot is disabled");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  let loginInProgress = true;

  client.once("clientReady", (readyClient) => {
    loginInProgress = false;
    logger.info({ tag: readyClient.user.tag }, "Discord bot is ready");
  });

  client.on("messageCreate", (message) => {
    void handleMessage(message).catch((error) => {
      logger.error({ err: error }, "Discord message handling failed");
    });
  });

  client.on("error", (error) => {
    logger.error({ err: error }, "Discord client error");
  });

  client.on("shardDisconnect", (closeEvent, shardId) => {
    logger.warn(
      { code: closeEvent.code, reason: closeEvent.reason, shardId },
      "Discord gateway disconnected",
    );
  });

  client.on("shardReconnecting", (shardId) => {
    logger.info({ shardId }, "Discord gateway reconnecting");
  });

  client.on("shardResume", (shardId, replayedEvents) => {
    logger.info(
      { replayedEvents, shardId },
      "Discord gateway connection resumed",
    );
  });

  client.on("shardError", (error, shardId) => {
    logger.error({ err: error, shardId }, "Discord gateway error");
  });

  const login = (): void => {
    if (loginInProgress || client.isReady()) return;

    loginInProgress = true;
    void client.login(token).catch((error: unknown) => {
      loginInProgress = false;
      const message = error instanceof Error ? error.message : String(error);

      if (message === "Used disallowed intents") {
        logger.error(
          { err: error },
          "Discord rejected the bot intents; enable Message Content Intent in the Discord Developer Portal",
        );
        return;
      }

      logger.error({ err: error }, "Discord bot login failed");
    });
  };

  const watchdog = setInterval(() => {
    if (client.isReady() || loginInProgress) return;

    logger.warn(
      "Discord bot is not ready; restarting the gateway login",
    );
    client.destroy();
    login();
  }, GATEWAY_WATCHDOG_INTERVAL_MS);
  watchdog.unref();

  void client.login(token).catch((error: unknown) => {
    loginInProgress = false;
    const message = error instanceof Error ? error.message : String(error);

    if (message === "Used disallowed intents") {
      logger.error(
        { err: error },
        "Discord rejected the bot intents; enable Message Content Intent in the Discord Developer Portal",
      );
      return;
    }

    logger.error({ err: error }, "Discord bot login failed");
  });
}