import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "Query",
    index: "byRecipient",
    query: {
      expression: "recipientId = :me",
      expressionValues: {
        ":me": { S: ctx.identity.sub },
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
    items: ctx.result?.items ?? [],
    nextToken: ctx.result?.nextToken ?? null,
  };
}
