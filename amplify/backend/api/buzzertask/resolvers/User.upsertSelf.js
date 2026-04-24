import { util } from "@aws-appsync/utils";

function callerProfile(ctx) {
  const claims = ctx.identity?.claims ?? {};
  const email = claims.email ?? `${ctx.identity.sub}@unknown.local`;
  const username =
    claims.preferred_username ??
    claims["cognito:username"] ??
    email.split("@")[0];

  return {
    id: ctx.identity.sub,
    email,
    username,
    displayName: claims.name ?? username,
    createdAt: util.time.nowISO8601(),
  };
}

export function request(ctx) {
  const profile = callerProfile(ctx);

  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({ id: profile.id }),
    update: {
      expression:
        "SET email = if_not_exists(email, :email), username = if_not_exists(username, :username), displayName = if_not_exists(displayName, :displayName), createdAt = if_not_exists(createdAt, :createdAt)",
      expressionValues: util.dynamodb.toMapValues({
        ":email": profile.email,
        ":username": profile.username,
        ":displayName": profile.displayName,
        ":createdAt": profile.createdAt,
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.prev?.result ?? ctx.result;
}
