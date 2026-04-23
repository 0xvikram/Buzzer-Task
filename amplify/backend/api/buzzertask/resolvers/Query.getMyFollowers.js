// Query.getMyFollowers
// Queries the "byTarget" GSI on the Follows table
// Returns all users who follow the caller (status = ACCEPTED)
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;

  return {
    operation: "Query",
    index: "byTarget",
    query: {
      expression: "targetId = :me AND #s = :accepted",
      expressionNames: { "#s": "status" },
      expressionValues: {
        ":me": { S: callerId },
        ":accepted": { S: "ACCEPTED" },
      },
    },
    limit: ctx.args.limit ?? 20,
    nextToken: ctx.args.nextToken ?? null,
    scanIndexForward: false, // newest followers first
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const items = (ctx.result.items ?? []).map((item) => ({
    user: { id: item.requesterId },
    followedAt: item.updatedAt,
    status: item.status,
  }));

  return {
    items,
    nextToken: ctx.result.nextToken ?? null,
  };
}
