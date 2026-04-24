import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const id = ctx.source?.user?.id ?? ctx.source?.requesterId ?? ctx.source?.targetId;

  if (!id) {
    return null;
  }

  return {
    operation: "GetItem",
    key: util.dynamodb.toMapValues({ id }),
    consistentRead: true,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result ?? null;
}
