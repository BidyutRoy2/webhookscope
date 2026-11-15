// Paste-your-Update inspector (pure, no DOM). Decodes one Telegram Update
// and says which handler/router it matches and what it should produce.
export const UPDATE_TYPES = [
  'message', 'edited_message', 'channel_post', 'edited_channel_post',
  'message_reaction', 'message_reaction_count', 'inline_query',
  'chosen_inline_result', 'callback_query', 'shipping_query',
  'pre_checkout_query', 'poll', 'poll_answer', 'my_chat_member',
  'chat_member', 'chat_join_request', 'chat_boost', 'removed_chat_boost',
  'business_connection', 'business_message', 'edited_business_message',
  'deleted_business_messages', 'purchased_paid_media',
];

export function inspectUpdate(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return { ok: false, error: 'That is not valid JSON.' }; }
  }
  if (!obj || typeof obj !== 'object' || typeof obj.update_id === 'undefined') {
    return { ok: false, error: 'This does not look like a Telegram Update (no update_id field).' };
  }
  const present = UPDATE_TYPES.filter((t) => typeof obj[t] !== 'undefined');
  const type = present[0] || 'unknown';
  const tree = [];
  const walk = (node, prefix, depth) => {
    if (depth > 3 || node === null || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        tree.push({ key: `${prefix}${k}`, value: '{…}', kind: 'object' });
        walk(v, `${prefix}${k}.`, depth + 1);
      } else if (Array.isArray(v)) {
        tree.push({ key: `${prefix}${k}`, value: `[${v.length} item(s)]`, kind: 'array' });
      } else {
        tree.push({ key: `${prefix}${k}`, value: String(v).slice(0, 120), kind: typeof v });
      }
    }
  };
  walk(obj, '', 0);
  const handlers = {
    message: 'message handler → reply with sendMessage to chat.id',
    edited_message: 'edited_message handler (NOT the message handler — edits are a separate Update type)',
    channel_post: 'channel_post handler → note: update.message is empty for channel posts',
    callback_query: 'callback_query handler → answer with answerCallbackQuery, then editMessageText if needed',
    inline_query: 'inline_query handler → answer with answerInlineQuery',
    poll_answer: 'poll_answer handler',
    my_chat_member: 'my_chat_member handler → bot was added/removed or its status changed',
    chat_member: 'chat_member handler',
    chat_join_request: 'chat_join_request handler → approve/decline with approveChatJoinRequest',
    pre_checkout_query: 'pre_checkout_query handler → answer with answerPreCheckoutQuery (payments)',
  };
  const chatId = obj.message?.chat?.id ?? obj.callback_query?.message?.chat?.id ?? obj.channel_post?.chat?.id ?? null;
  const text = obj.message?.text ?? obj.edited_message?.text ?? obj.callback_query?.data ?? null;
  return {
    ok: true, updateId: obj.update_id, type, present,
    handler: handlers[type] || `${type} handler`,
    chatId, text,
    sendMessage: chatId ? { method: 'sendMessage', chat_id: chatId, text: text ? `Echo: ${text}` : '(your reply here)' } : null,
    tree,
  };
}
