import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const { input } = ctx.args;
  return {
    operation: "PutItem",
    key: { id: util.dynamodb.toDynamoDB(input.id) },
    attributeValues: util.dynamodb.toMapValues({
      ...input,
      read: false,
      createdAt: util.time.nowISO8601()
    }),
    condition: {
      expression: "attribute_not_exists(id)"
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
