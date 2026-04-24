import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;

  return {
    operation: "Query",
    index: "byRequester",
    query: {
      expression: "requesterId = :me AND #s = :accepted",
      expressionNames: { "#s": "status" },
      expressionValues: {
        ":me": { S: callerId },
        ":accepted": { S: "ACCEPTED" },
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

  const items = (ctx.result.items ?? []).map((item) => ({
    user: { id: item.targetId },
    followedAt: item.updatedAt,
    status: item.status,
  }));

  return {
    items,
    nextToken: ctx.result.nextToken ?? null,
  };
}
