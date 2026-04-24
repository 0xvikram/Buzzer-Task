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
