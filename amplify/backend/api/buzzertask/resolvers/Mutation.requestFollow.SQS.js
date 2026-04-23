import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { targetUserId } = ctx.args;

  const messageBody = JSON.stringify({
    recipientId: targetUserId,
    senderId: callerId,
    type: "FOLLOW_REQUEST_RECEIVED",
    timestamp: util.time.nowISO8601(),
  });

  return {
    method: "POST",
    resourcePath: "/",
    params: {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `Action=SendMessage&MessageBody=${util.urlEncode(messageBody)}&Version=2012-11-05`,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.appendError(ctx.error.message, "SQSPublishError");
  }

  return ctx.prev.result;
}
