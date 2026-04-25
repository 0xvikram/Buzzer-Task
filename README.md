# Buzzer Task

Backend for a social app built with AWS Amplify Gen 1, AppSync, Cognito, DynamoDB, Lambda, and SQS.

## What is implemented

- AppSync GraphQL API with Cognito User Pools as the default auth mode and IAM as a secondary auth mode.
- Cognito post-confirmation persistence of user profiles into `BuzzerUsers-<api-id>-<env>`.
- Custom follow mutations:
  - `requestFollow`
  - `acceptFollowRequest`
- Custom queries:
  - `getMyProfile`
  - `getMyFollowers`
  - `getMyFollowings`
  - `getMyPendingFollowRequests`
  - `getMyNotifications`
- Authorized subscriptions:
  - `onFollowAccepted`
  - `onNotification`
- Async notification pipeline:
  - follow mutations write follow state
  - AppSync publishes notification events to SQS
  - `notificationProcessor` Lambda consumes SQS
  - Lambda calls IAM-only `createNotificationInternal`
  - AppSync writes notification records and triggers subscriptions

## Architecture decisions

- Users are stored in a dedicated DynamoDB table created by the API custom stack. Cognito remains the identity source; DynamoDB is the profile store.
- Follow relationships use a composite primary key of `requesterId + targetId` plus two GSIs:
  - `byTarget` for followers and pending inbound requests
  - `byRequester` for followings
- Notification creation flows through AppSync instead of writing directly to DynamoDB so AppSync subscriptions fire on the internal mutation.
- Authorization beyond basic authentication is enforced manually in resolver code:
  - users cannot follow themselves
  - only the target user can accept a pending follow request
  - subscription arguments must match the caller's identity
- The custom CloudFormation stack owns the non-generated infrastructure:
  - users/follows/notifications tables
  - SQS queue and DLQ
  - notification processor Lambda
  - Cognito post-confirmation trigger Lambda and trigger wiring
  - AppSync custom resolvers and functions

## Requirement mapping and Q&A (what was done and why)

### 1) AppSync API

**What was required**

- Build AppSync GraphQL API
- Cognito User Pools as default auth
- IAM as secondary auth

**What I implemented**

- GraphQL contract in `amplify/backend/api/buzzertask/schema.graphql`
- Default user-facing operations use `@aws_cognito_user_pools`
- Internal operations use `@aws_iam` (`createNotificationInternal`, `upsertUserProfileInternal`)

**Why this design**

- Cognito secures client/user operations with JWT tokens.
- IAM secures internal backend-only writes (Lambda/service calls), preventing direct client abuse.

---

### 2) User authentication and persistence

**What was required**

- Cognito auth
- Persist profile after registration via Cognito trigger

**What I implemented**

- Cognito User Pool for sign-up/sign-in
- Post-confirmation trigger Lambda at `amplify/backend/function/postConfirmationTrigger/src/index.mjs`
- User profile row written to `BuzzerUsers-<api-id>-<env>`

**Why this design**

- Cognito remains the identity source of truth (`sub`, credentials, auth claims).
- DynamoDB stores app profile data used by GraphQL resolvers.
- Trigger-based persistence guarantees profile creation regardless of client implementation.
- <img width="797" height="606" alt="image" src="https://github.com/user-attachments/assets/fd6e25ac-ff76-43c7-bde0-8cec7308e895" />
<img width="629" height="714" alt="image" src="https://github.com/user-attachments/assets/0095ac4d-ff9e-44d3-9c88-deed3912d57c" />



---

### 3) Follow system (custom mutations, queries, subscription)

**What was required**

- Custom follow request and accept mutations
- My followers and my followings queries
- Authorized subscription on follow acceptance

**What I implemented**

- Custom mutations: `requestFollow`, `acceptFollowRequest`
- Queries: `getMyFollowers`, `getMyFollowings`, `getMyPendingFollowRequests`
- Subscription: `onFollowAccepted(requesterId: ID!)`

**Data model and access patterns**

- Follows table primary key: `requesterId + targetId`
- GSI `byTarget`: efficient followers and pending inbound requests
- GSI `byRequester`: efficient followings

**Why this design**

- Access patterns were designed first, then keys/indexes were chosen to avoid scans.
- Composite keys plus status-based sort/query support both directions efficiently.

**Manual authorization beyond @auth**

- `requestFollow`: blocks self-follow in resolver logic
- `acceptFollowRequest`: only target user can accept request addressed to them
- `onFollowAccepted` subscription resolver validates `ctx.identity.sub === args.requesterId`

This satisfies the expectation to enforce business authorization explicitly in code, not only via directives.

---

### 4) Notification system and async processing

**What was required**

- Multipurpose notification table
- Notify on follow request received and follow accepted
- Real-time notification subscription with authorization
- Async pipeline: mutation -> SQS -> Lambda -> notification write

**What I implemented**

- Notification table with typed notifications (`FOLLOW_REQUEST_RECEIVED`, `FOLLOW_REQUEST_ACCEPTED`)
- Follow mutations publish events to SQS via resolver pipeline steps
- `notificationProcessor` Lambda consumes queue and creates notifications
- Real-time subscription: `onNotification(recipientId: ID!)`

**Why Lambda writes via IAM AppSync mutation (not direct DynamoDB)**

- Chosen approach: Lambda calls IAM-only `createNotificationInternal` in AppSync.
- Reason: AppSync subscriptions are mutation-driven. Writing directly to DynamoDB would bypass AppSync mutation fanout and not emit subscription events.
- Trade-off: one extra hop (Lambda -> AppSync -> DynamoDB), accepted for correct real-time behavior and centralized policy enforcement.

**Manual authorization beyond @auth**

- `onNotification` subscription resolver validates `ctx.identity.sub === args.recipientId`.
- Prevents one user from subscribing to another user's notification stream.

---

### 5) Security model summary

- Coarse-grained auth: schema directives (`@aws_cognito_user_pools`, `@aws_iam`)
- Fine-grained auth: resolver code checks caller identity and ownership rules
- Internal-only write paths protected with IAM
- Idempotency on write paths where retries can happen

---

## Deploy

Prerequisites:

- Node.js 20+
- AWS CLI configured
- Amplify CLI installed

Deploy:

```bash
cd Buzzer-Task
amplify push --allow-destructive-graphql-schema-updates
```

If Amplify reports that it will delete legacy model tables, keep the flag and back up any data you still need before pushing.

The deployment relies on:

- `amplify/backend/api/buzzertask/stacks/CustomResources.json`

That stack creates and wires the DynamoDB tables, SQS resources, Lambda functions, Cognito trigger integration, and AppSync custom resources.

## Test

Run the end-to-end demo:

```bash
node test/run-demo.mjs
```

The script resolves config in this order:

1. Environment variables: `USER_POOL_ID`, `CLIENT_ID`, `APPSYNC_ENDPOINT`, `AWS_REGION`
2. `ui/amplifyconfiguration.json` generated after `amplify push`

Normal flow:

```bash
amplify push --allow-destructive-graphql-schema-updates
node test/run-demo.mjs
```

The demo validates:

- post-confirmation profile persistence via `getMyProfile`
- follow request creation
- follow acceptance
- followers/followings query correctness
- asynchronous notification creation for both notification types
- IAM-only protection on `createNotificationInternal`

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
- The automated demo does not currently assert WebSocket subscription delivery; that still needs manual verification against a deployed environment if you want an explicit subscription proof in addition to mutation-driven notification creation.
