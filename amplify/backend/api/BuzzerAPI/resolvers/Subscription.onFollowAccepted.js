// Subscription.onFollowAccepted
// Fires when a follow request the caller sent gets accepted.
//
// Manual auth rule (beyond @auth):
//   The caller can ONLY subscribe with their own sub as requesterId.
//   Subscribing as someone else → immediate Unauthorized error.
//   This prevents user A from listening to user B's accepted-follow events.
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  // ── Identity enforcement ──────────────────────────────────────────────────
  if (ctx.identity.sub !== ctx.args.requesterId) {
    util.error(
      "Unauthorized: you may only subscribe to your own follow events",
      "Unauthorized"
    );
  }
  return { payload: null };
}

export function response(ctx) {
  return ctx.result;
}
