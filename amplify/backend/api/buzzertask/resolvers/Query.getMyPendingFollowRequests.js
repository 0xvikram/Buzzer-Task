import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;

  return {
    operation: "Query",
    index: "byTarget",
    query: {
      expression: "targetId = :me AND #s = :pending",
      expressionNames: { "#s": "status" },
      expressionValues: {
        ":me": { S: callerId },
        ":pending": { S: "PENDING" },
      },
    },
    limit: ctx.args.limit ?? 20,
    nextToken: ctx.args.nextToken ?? null,
    scanIndexForward: false,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return {
    items: (ctx.result?.items ?? []).map((item) => ({
      user: { id: item.requesterId },
      followedAt: item.createdAt,
      status: item.status,
    })),
    nextToken: ctx.result?.nextToken ?? null,
  };
}
