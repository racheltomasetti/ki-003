# 2026-07-11 — pursuit agent clear

## Goal
Add a clear conversation button to the pursuit agent chat panel.
Clears all messages for the current pursuit from `pursuit_conversations` in DB and resets local state.

## Shipped
- `clearPursuitConversation(client, pursuitId)` added to `packages/services/src/pursuit_conversations.ts`
- Clear button added to `ChatPanel` header (visible only when messages exist)
- `onClearMessages` prop threaded from `PursuitDetailClient` → `ChatPanel`
- Handler in root deletes from DB then resets local `messages` state and `messageCitations`

## DB / Schema
No migrations. Uses existing `pursuit_conversations` table.
Delete query: `DELETE FROM pursuit_conversations WHERE pursuit_id = X` — RLS enforces user scoping.

## Decisions
- Clear button lives in the chat panel header, right side, muted — only appears when there are messages
- No confirmation dialog — small enough action, easy to restart a conversation
- Clears `messageCitations` map too so citation chips don't ghost after clear

## Blocked / Deferred
-

## Next
-
