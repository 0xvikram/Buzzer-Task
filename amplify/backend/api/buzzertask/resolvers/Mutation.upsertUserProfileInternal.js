import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const input = ctx.args.input;

  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({
      id: input.id,
    }),
    attributeValues: util.dynamodb.toMapValues({
      username: input.username,
      email: input.email,
      displayName: input.displayName ?? input.username,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: input.createdAt,
    }),
    condition: {
      expression: "attribute_not_exists(id)",
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === "DynamoDB:ConditionalCheckFailedException") {
      return {
        id: ctx.args.input.id,
        username: ctx.args.input.username,
        email: ctx.args.input.email,
        displayName: ctx.args.input.displayName ?? ctx.args.input.username,
        avatarUrl: ctx.args.input.avatarUrl ?? null,
        createdAt: ctx.args.input.createdAt,
      };
    }

    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result;
}
