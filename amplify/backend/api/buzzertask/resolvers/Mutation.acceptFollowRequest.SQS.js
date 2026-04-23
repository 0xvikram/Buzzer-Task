// Mutation.acceptFollowRequest — Step 2: Publish FOLLOW_REQUEST_ACCEPTED event to SQS
// Pipeline step 2 of 2 — runs after DDB UpdateItem succeeds
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub; // accepter = the target
  const { requesterId } = ctx.args; // original requester gets the notification

  const messageBody = JSON.stringify({
    recipientId: requesterId, // notify the person who sent the request
    senderId: callerId,
    type: "FOLLOW_REQUEST_ACCEPTED",
    timestamp: util.time.nowISO8601(),
  });

  return {
    method: "POST",
    resourcePath: "/",
    params: {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `Action=SendMessage&MessageBody=${encodeURIComponent(messageBody)}&Version=2012-11-05`,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.appendError(ctx.error.message, "SQSPublishError");
  }
  return ctx.prev.result;
}
