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
