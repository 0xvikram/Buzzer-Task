// Mutation.requestFollow — Step 1: Write pending follow record to DynamoDB
// Pipeline step 1 of 2 (step 2 sends SQS message)
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { targetUserId } = ctx.args;

  // ── Manual auth check: cannot follow yourself ─────────────────────────────
  if (callerId === targetUserId) {
    util.error("Cannot follow yourself", "ValidationError");
  }

  const now = util.time.nowISO8601();

  return {
    operation: "PutItem",
    key: {
      requesterId: { S: callerId },
      targetId: { S: targetUserId },
    },
    attributeValues: {
      status: { S: "PENDING" },
      createdAt: { S: now },
      updatedAt: { S: now },
    },
    condition: {
      // Prevent duplicate follow requests — idempotent
      expression:
        "attribute_not_exists(requesterId) AND attribute_not_exists(targetId)",
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === "DynamoDB:ConditionalCheckFailedException") {
      util.error(
        "A follow request already exists between these users",
        "DuplicateError"
      );
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
