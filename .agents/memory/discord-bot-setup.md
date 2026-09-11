---
name: Discord bot setup
description: Discord OAuth connections are account-level and cannot replace a bot gateway token.
---

The Discord connector's OAuth token cannot receive or post channel messages through the Discord bot gateway. A Discord application bot token must be stored as a project secret, and any feature that reads message content requires the Message Content Intent enabled in the Discord Developer Portal.

**Why:** Discord rejects gateway login with “Used disallowed intents” when Message Content Intent is requested but not enabled, and the OAuth connector explicitly has a user-token scope boundary for channel messages.

**How to apply:** For Discord message-handling bots, request `DISCORD_TOKEN` through the secure secrets flow, keep `MessageContent` in the gateway intents, and tell the user to enable the privileged intent before restarting the service.