import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const now = util.time.nowISO8601();

  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({
      id: ctx.args.input.id,
      recipientId: ctx.args.input.recipientId,
    }),
    attributeValues: util.dynamodb.toMapValues({
      senderId: ctx.args.input.senderId,
      type: ctx.args.input.type,
      read: false,
      createdAt: now,
    }),
    condition: {
      expression: "attribute_not_exists(id)",
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === "DynamoDB:ConditionalCheckFailedException") {
      return null;
    }
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result;
}
