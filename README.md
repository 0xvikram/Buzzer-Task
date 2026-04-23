# Buzzer Task

Backend for a social app built with AWS Amplify Gen 1, AppSync, Cognito, DynamoDB, Lambda, and SQS.

## What is implemented

- Cognito User Pool auth with IAM as secondary AppSync auth mode.
- Cognito post-confirmation trigger that persists user profiles into `BuzzerUsers-<env>`.
- Custom follow mutations:
  - `requestFollow`
  - `acceptFollowRequest`
- Custom follow queries:
  - `getMyProfile`
  - `getMyFollowers`
  - `getMyFollowings`
  - `getMyPendingFollowRequests`
  - `getMyNotifications`
- Authorized subscriptions:
  - `onFollowAccepted`
  - `onNotification`
- Async notification flow:
  - AppSync mutation writes follow state
  - AppSync publishes an event to SQS
  - `notificationProcessor` Lambda consumes SQS
  - Lambda calls IAM-only `createNotificationInternal`
  - AppSync mutation writes notification records and triggers subscriptions

## Architecture decisions

- Users are stored in a dedicated DynamoDB table created from the auth override. Cognito remains the identity source; DynamoDB is the profile store.
- Follow relationships use a primary key of `requesterId + targetId` plus two GSIs:
  - `byTarget` for followers and pending requests received
  - `byRequester` for followings
- Notification creation happens through AppSync, not direct DynamoDB writes, because AppSync subscriptions are mutation-driven.
- Authorization is enforced in resolver code for:
  - self-follow prevention
  - accepting only requests addressed to the caller
  - subscription scoping to the caller's own identity

## Deploy

Prerequisites:

- Node.js 20+
- AWS CLI configured
- Amplify CLI installed

Deploy steps:

```bash
cd Buzzer-Task
amplify push --allow-destructive-graphql-schema-updates
```

If Amplify reports that it will delete model tables (for example `UserTable`), this
flag is required to proceed. If that table still contains data you need, export or
back it up before running the command.

The project now relies on:

- `amplify/backend/auth/buzzertaskcc0bb83c/overrides.ts`
- `amplify/backend/api/buzzertask/stacks/CustomResources.json`

Those files create the custom Cognito trigger, DynamoDB tables, SQS queue, Lambda consumer, and AppSync resolvers/data sources.

## Test

Run the end-to-end demo:

```bash
node test/run-demo.mjs
```

The demo script resolves config in this order:

1. Environment variables (`USER_POOL_ID`, `CLIENT_ID`, `APPSYNC_ENDPOINT`, `AWS_REGION`)
2. `ui/amplifyconfiguration.json` generated after a successful `amplify push`

So a normal flow is:

```bash
amplify push --allow-destructive-graphql-schema-updates
node test/run-demo.mjs
```

The script now fails if:

- a mutation returns `null`
- followers/followings queries return `null`
- Alice does not appear in Bob's followers
- Bob does not appear in Alice's followings

## UI

Serve the static demo UI:

```bash
npx serve ui
```

Pages:

- `ui/index.html`
- `ui/auth.html`
- `ui/dashboard.html`
- `ui/profile.html`

## Known limitations

- The OpenSearch bonus task is not implemented.
- The UI is a thin demo client, not a production frontend.
- Final validation still requires a real `amplify push` in your AWS account because the custom auth override and custom AppSync stack are deployment-time resources.
