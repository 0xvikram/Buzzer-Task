// Subscription.onNotification
// Fires when a new notification is created for the caller.
//
// Manual auth rule (beyond @auth):
//   The caller can ONLY subscribe with their own sub as recipientId.
//   This prevents user A from receiving user B's notifications.
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  // ── Identity enforcement ──────────────────────────────────────────────────
  if (ctx.identity.sub !== ctx.args.recipientId) {
    util.error(
      "Unauthorized: you may only subscribe to your own notifications",
      "Unauthorized"
    );
  }
  return { payload: null };
}

export function response(ctx) {
  return ctx.result;
}
