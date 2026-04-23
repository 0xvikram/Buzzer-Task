// Mutation.requestFollow — Step 2: Publish FOLLOW_REQUEST_RECEIVED event to SQS
// Pipeline step 2 of 2 (runs after DynamoDB PutItem succeeds)
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { targetUserId } = ctx.args;

  // Build SQS SendMessage payload
  const messageBody = JSON.stringify({
    recipientId: targetUserId,
    senderId: callerId,
    type: "FOLLOW_REQUEST_RECEIVED",
    timestamp: util.time.nowISO8601(),
  });

  const QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/461780750039/BuzzerNotificationQueue-dev";

  // SQS HTTP data source request
  return {
    method: "POST",
    resourcePath: "/",
    params: {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `Action=SendMessage&QueueUrl=${util.urlEncode(QUEUE_URL)}&MessageBody=${util.urlEncode(messageBody)}&Version=2012-11-05`,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    // Log but do not fail the mutation — follow was already created in DDB
    util.appendError(ctx.error.message, "SQSPublishError");
  }
  // Return the follow record from the previous pipeline step
  return ctx.prev.result;
}
