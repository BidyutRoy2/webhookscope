// Framework fix cards. Copyable commands only — this page never calls
// deleteWebhook / setWebhook itself. Every destructive fix defaults to
// KEEPING the backlog; drop_pending_updates=true discards up to 24h of
// queued updates and must be a deliberate choice.
export const FIXES = {
  aiogram: {
    label: 'aiogram (Python)',
    steps: [
      'Stop every copy of the bot (local + server + containers).',
      'Remove the webhook from your own code — never from this page:',
    ],
    code: 'await bot.delete_webhook()\n# keep the backlog (default):\n# await bot.delete_webhook(drop_pending_updates=False)',
    warning: 'drop_pending_updates=True discards up to 24 hours of queued updates. Default is to keep them.',
    extra: 'Then restart exactly one poller: await dp.start_polling(bot).',
  },
  'python-telegram-bot': {
    label: 'python-telegram-bot',
    steps: [
      'Stop every copy of the bot.',
      'Remove the webhook from your own code:',
    ],
    code: 'await application.bot.delete_webhook()\n# run_polling() already removes the webhook itself —\n# if you call run_polling, do not also set a webhook.',
    warning: 'drop_pending_updates=True discards up to 24 hours of queued updates. Default is to keep them.',
    extra: 'Then start exactly one instance with application.run_polling().',
  },
  telegraf: {
    label: 'Telegraf (Node.js)',
    steps: [
      'Stop every copy of the bot.',
      'Remove the webhook from your own code:',
    ],
    code: 'await bot.telegram.deleteWebhook();\n// then launch polling exactly once:\nbot.launch();',
    warning: 'drop_pending_updates=true discards up to 24 hours of queued updates. Default is to keep them.',
    extra: 'If you use a webhook on purpose, check that only ONE deploy holds this token.',
  },
  grammy: {
    label: 'grammY (Node.js / Deno)',
    steps: [
      'Stop every copy of the bot.',
      'Remove the webhook from your own code:',
    ],
    code: 'await bot.api.deleteWebhook();\n// then start polling exactly once:\nbot.start();',
    warning: 'drop_pending_updates=true discards up to 24 hours of queued updates. Default is to keep them.',
    extra: 'If you run grammY on a serverless host, make sure only one deployment is live.',
  },
  n8n: {
    label: 'n8n — the Melardenio fix',
    steps: [
      'Do NOT restart your poller — it will be knocked over again.',
      'In BotFather: /newbot — create a SECOND bot, just for n8n.',
      'Paste the NEW token into n8n → Credentials → Telegram only.',
      'Keep the OLD token for your own bot. One token, one consumer — forever.',
    ],
    code: '# on your own bot, remove the stolen webhook:\ncurl "https://api.telegram.org/bot<OLD_TOKEN>/deleteWebhook"\n# (no drop_pending_updates flag = backlog is kept)',
    warning: 'Restarting the poller does not help: the n8n Trigger will re-register its webhook and terminate polling again. If you delete the webhook, do it without drop_pending_updates=true unless you accept losing up to 24 hours of queued updates.',
    extra: 'Then check n8n → Workflows → Telegram Trigger: it should show the NEW bot, not the old one.',
  },
  openclaw: {
    label: 'OpenClaw',
    steps: [
      'Stop ALL OpenClaw gateways — local machine, VPS, containers, every copy.',
      'Wait one minute (Telegram needs the old poll lease to expire).',
      'Start exactly ONE gateway.',
      'Check getWebhookInfo again: url must be empty while polling.',
    ],
    code: '# do not run getUpdates yourself to test — that call\n# counts as a second poller and causes the 409 you chase.\n# Safe read-only checks only:\ncurl "https://api.telegram.org/bot<TOKEN>/getMe"\ncurl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"',
    warning: 'A restart alone hides this failure: systemd / auto-restart will keep colliding pollers alive. If you delete the webhook, do it without drop_pending_updates=true unless you accept losing up to 24 hours of queued updates.',
    extra: 'If the 409 survives a fresh token, the duplicate is inside your own setup — check the gateway config, not Telegram.',
  },
};

export const FRAMEWORKS = Object.keys(FIXES);
