import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { requesterId } = ctx.args;

  const messageBody = JSON.stringify({
    recipientId: requesterId,
    senderId: callerId,
    type: "FOLLOW_REQUEST_ACCEPTED",
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
