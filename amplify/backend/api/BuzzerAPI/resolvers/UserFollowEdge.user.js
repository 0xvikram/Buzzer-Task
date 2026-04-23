import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "GetItem",
    key: { id: util.dynamodb.toDynamoDB(ctx.source.user.id) }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
