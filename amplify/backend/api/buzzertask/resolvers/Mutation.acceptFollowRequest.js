// Mutation.acceptFollowRequest
// Security model: the DynamoDB key includes targetId: ctx.identity.sub
// If a different user tries to accept, their sub won't match the stored targetId
// → DynamoDB ConditionalCheckFailedException fires automatically
// This is stronger than an if-check because it is enforced at the storage layer
import { util } from "@aws-appsync/utils";

//ctx = context object provided by AppSync to resolver
export function request(ctx) {
  const callerId = ctx.identity.sub; // the person accepting (must be the target)
  const { requesterId } = ctx.args;


  const now = util.time.nowISO8601();

  return {
    operation: "UpdateItem",
    key: {
      requesterId: { S: requesterId },
      targetId: { S: callerId }, // ← auth enforced here at the storage layer
    },
    update: {
      expression: "SET #s = :accepted, updatedAt = :now",
      expressionNames: { "#s": "status" },
      expressionValues: {
        ":accepted": { S: "ACCEPTED" },
        ":pending": { S: "PENDING" },
        ":now": { S: now },
      },
    },
    condition: {
      // Must exist AND must currently be PENDING (cannot re-accept)
      expression: "attribute_exists(requesterId) AND #s = :pending",
      expressionNames: { "#s": "status" },
      expressionValues: { ":pending": { S: "PENDING" } },
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === "DynamoDB:ConditionalCheckFailedException") {
      util.error(
        "No pending follow request found, or you are not the target user",
        "NotFoundOrUnauthorized"
      );
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
