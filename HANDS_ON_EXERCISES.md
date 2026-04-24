# Buzzer Task: Hands-On Learning Exercises

This guide contains **practical exercises** you can do RIGHT NOW to understand the codebase deeply. Do these in order.

---

## Exercise 1: Deploy, Test, and Verify

### Goal
Get the system running and see it work end-to-end.

### Tasks

**Step 1: Deploy to AWS**
```bash
cd c:\Users\singh\Desktop\Buzzer-Task
amplify push --allow-destructive-graphql-schema-updates --yes
```

**What you're watching for:**
- All resources created successfully (watch the progress bar)
- No errors about permissions
- Once done: `✓ Deployment complete`

**Step 2: Run the test script**
```bash
node test/run-demo.mjs
```

**What you should see:**
```
✓ User A signed up and confirmed
✓ User B signed up and confirmed
✓ User A requested to follow User B
✓ User B accepted the follow request
✓ User A is in User B's followers list
✓ User B is in User A's followings list
```

**If it fails:**
- Error message tells you which step broke
- Debugging exercise (see Exercise 2)

**Step 3: Check the AWS Console**
1. Go to AWS Console → DynamoDB → Tables → BuzzerUsers-dev
2. Click "Items"
3. You should see 2 users (User A, User B from the test)
4. Each user has: id, email, username, displayName, createdAt

**Reflection questions:**
- How many items are in the Follows table?
- How many in the Notifications table?
- What's the status of the follow from User A to User B?

---

## Exercise 2: Understand Auth Flow by Manually Testing

### Goal
See how JWT tokens work and how AppSync validates them.

### Tasks

**Step 1: Test Unauthenticated Access (should fail)**
```bash
# Use curl to call AppSync WITHOUT auth
curl -X POST \
  https://<your-appsync-endpoint>/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { getMyProfile { id username } }"
  }'
```

**Expected error:**
```json
{
  "errors": [
    {
      "message": "The request is not authorized",
      "errorType": "Unauthorized"
    }
  ]
}
```

**Why?** The query has `@aws_cognito_user_pools` decorator. Cognito needs valid JWT.

**Step 2: Get a valid JWT token**
```bash
# Use the test script to get tokens
# Modify test/run-demo.mjs line where it gets tokens
# Log the token to console

# Or manually sign in to Cognito:
aws cognito-idp initiate-auth \
  --client-id <YOUR_CLIENT_ID> \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=alice@example.com,PASSWORD=<PASSWORD> \
  --region ap-south-1
```

**You'll get back:**
```json
{
  "AuthenticationResult": {
    "IdToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "AccessToken": "...",
    "RefreshToken": "..."
  }
}
```

**Step 3: Decode the token to see claims**
1. Go to https://jwt.io
2. Paste the IdToken in "Encoded" section
3. You see the decoded claims:
   ```json
   {
     "sub": "550e8400-e29b-41d4-a716-446655440000",
     "email_verified": true,
     "email": "alice@example.com",
     "preferred_username": "alice",
     "name": "Alice Smith",
     "iat": 1713873600,
     "exp": 1713877200
   }
   ```

**Key observations:**
- `sub` = Cognito user ID (what you use as `ctx.identity.sub` in resolvers)
- `exp` = Token expiry (Unix timestamp)
- All claims are readable (JWT is base64, not encrypted)
- Token integrity is verified by signature (the part after last `.`)

**Step 4: Call AppSync WITH token**
```bash
curl -X POST \
  https://<your-appsync-endpoint>/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_IDTOKEN>" \
  -d '{
    "query": "query { getMyProfile { id username } }"
  }'
```

**Expected success:**
```json
{
  "data": {
    "getMyProfile": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "alice"
    }
  }
}
```

**Reflection questions:**
- What changed between Step 1 and Step 4? Only the Authorization header
- How does AppSync know which user is calling? Decodes JWT → extracts `sub`
- What happens if token is expired? AppSync rejects it (similar to Step 1)

---

## Exercise 3: Trace a Mutation Through All Layers

### Goal
See exactly what happens when you call `requestFollow`.

### Tasks

**Step 1: Set up logging in AppSync Console**
1. AWS Console → AppSync → Select your API
2. Left panel → Settings (scroll down)
3. **CloudWatch Logs:** Enable and set to **VERBOSE**
   (Might already be enabled)
4. Click **Save**

**Step 2: Call requestFollow mutation via AppSync Explorer**
1. AWS Console → AppSync → Queries
2. Auth type: User Pool → Sign in
3. Mutation:
   ```graphql
   mutation {
     requestFollow(targetUserId: "target-user-id-here") {
       requesterId
       targetId
       status
       createdAt
     }
   }
   ```
4. Click Execute

**Step 3: Watch the resolver execute in real-time**
- While mutation runs, open CloudWatch Logs in a new tab
- Log group: `/aws/appsync/<api-id>`
- Newest log stream shows resolver execution

**Step 4: Examine DynamoDB to verify write**
1. AWS Console → DynamoDB → BuzzerFollows table
2. Click Items
3. Query: `requesterId = your-id AND targetId = target-id`
4. You should see the new Follow item with `status: PENDING`

**Step 5: Check SQS to see published event**
1. AWS Console → SQS → Select queue
2. Check: **Messages Available** (should be 1 or more)
3. If > 0, the message is there waiting for Lambda

**Step 6: Wait for Lambda to process (5-10 seconds)**
1. CloudWatch → Log group → `/aws/lambda/notificationProcessor`
2. Newest log stream shows Lambda execution
3. Look for: `[notificationProcessor] Created FOLLOW_REQUEST_RECEIVED notification`

**Step 7: Check Notifications table**
1. AWS Console → DynamoDB → BuzzerNotifications table
2. Query: `recipientId = target-user-id`
3. Should see a new Notification with `type: FOLLOW_REQUEST_RECEIVED`

**Full trace (all 3 steps of pipeline):**
```
AppSync Mutation
  ↓
Step 1: Mutation.requestFollow.js
  ├─ Validates: callerId ≠ targetUserId
  ├─ Writes to DynamoDB: BuzzerFollows table
  ├─ Returns Follow item
  └─ CloudWatch log: Request + response
  
  ↓ (same mutation, step 2 runs)
  
Step 2: Mutation.requestFollow.SQS.js
  ├─ Formats notification event (recipientId, senderId, type)
  ├─ Publishes to SQS queue
  └─ CloudWatch log: SQS publish successful
  
  ↓ (async, Lambda picks up message)
  
Lambda: notificationProcessor
  ├─ Polls SQS → sees message
  ├─ Parses JSON payload
  ├─ Signs IAM request to AppSync
  ├─ Calls createNotificationInternal mutation
  ├─ Writes to DynamoDB: BuzzerNotifications table
  └─ CloudWatch log: Notification created
```

**Reflection questions:**
- Where is authorization checked? (3 places: GraphQL decorator, resolver validation, DynamoDB condition)
- Why SQS instead of direct write? (Decoupling, retries, can add more consumers)
- Why IAM auth on `createNotificationInternal`? (Prevent clients from faking notifications)

---

## Exercise 4: Intentionally Break Things (and Fix Them)

### Goal
Learn debugging by causing failures and reading error messages.

### Task 1: Try to follow yourself

```graphql
mutation {
  requestFollow(targetUserId: "your-own-id-here") {
    requesterId
    targetId
    status
  }
}
```

**Expected error:**
```json
{
  "errors": [
    {
      "message": "Cannot follow yourself",
      "errorType": "ValidationError"
    }
  ]
}
```

**Lesson:** Validation happens in resolver code (Mutation.requestFollow.js line: `if (callerId === targetUserId)`)

---

### Task 2: Try to accept a follow request you didn't receive

1. Create a fake request ID (not a real requesterId)
2. Call:
```graphql
mutation {
  acceptFollowRequest(requesterId: "fake-user-id") {
    status
  }
}
```

**Expected error:**
```json
{
  "errors": [
    {
      "message": "No pending follow request found, or you are not the target user",
      "errorType": "NotFoundOrUnauthorized"
    }
  ]
}
```

**Lesson:** DynamoDB condition check fails because:
- The key is built using `targetId: callerId` (your ID)
- If a different requesterId or wrong targetId, DynamoDB returns ConditionalCheckFailedException
- Resolver catches this and returns friendly error

---

### Task 3: Try to call createNotificationInternal as a client

```graphql
mutation {
  createNotificationInternal(input: {
    id: "test-uuid"
    recipientId: "someone-id"
    senderId: "me"
    type: FOLLOW_REQUEST_RECEIVED
  }) {
    id
  }
}
```

**Expected error:**
```json
{
  "errors": [
    {
      "message": "The request is not authorized",
      "errorType": "Unauthorized"
    }
  ]
}
```

**Why?** The mutation has `@aws_iam` (not `@aws_cognito_user_pools`). Your JWT token is not valid for IAM auth. Only AWS services with the correct IAM role can call it.

---

### Task 4: Check what happens when Lambda fails

1. Modify `amplify/backend/function/notificationProcessor/src/index.mjs`
2. Add artificial failure:
   ```javascript
   throw new Error("Intentional test failure");
   ```
3. Deploy: `amplify push`
4. Call requestFollow mutation again
5. Watch the flow:
   - Mutation succeeds (Follow written)
   - SQS message published
   - Lambda invoked → throws error → CloudWatch logs show error
   - SQS retries (you can see in metrics)
   - After 3 retries → message goes to DLQ
6. Notification is NEVER created (but follow was created)
7. CloudWatch alarm would trigger (if you had one)

**Lesson:** SQS decouples the async part. Even if Lambda fails, the mutation already succeeded.

---

## Exercise 5: Query Data Different Ways

### Goal
Understand DynamoDB access patterns and why GSI matters.

### Scenario
```
Users:
- Alice (sub: alice-sub)
- Bob (sub: bob-sub)
- Charlie (sub: charlie-sub)

Follows (after several requests and acceptances):
- Alice → Bob (ACCEPTED)
- Charlie → Bob (ACCEPTED)
- Bob → Alice (ACCEPTED)
- Alice → Charlie (PENDING)
```

### Query 1: "How many users follow Bob?"

**DynamoDB approach:**
1. Go to DynamoDB → BuzzerFollows table
2. Query the GSI `byTarget`:
   ```
   targetId = bob-sub
   status = ACCEPTED
   ```
3. Result: [Alice, Charlie]

**GraphQL approach:**
```graphql
query {
  getMyFollowers {
    items {
      user { id username }
      followedAt
      status
    }
    nextToken
  }
}
```
(Run as Bob)

**Result:**
```json
{
  "items": [
    { "user": { "id": "alice-sub" }, "status": "ACCEPTED" },
    { "user": { "id": "charlie-sub" }, "status": "ACCEPTED" }
  ]
}
```

**What's happening:**
1. GraphQL calls Query.getMyFollowers resolver
2. Resolver queries `byTarget` GSI where `targetId = bob-sub AND status = ACCEPTED`
3. DynamoDB returns matching items
4. Resolver transforms them into UserFollowEdge objects
5. Returns to client

**Key insight:** Without GSI, you'd have to scan entire BuzzerFollows table and filter in memory. With GSI, it's instant.

---

### Query 2: "Get users I'm following with pagination"

```graphql
query {
  getMyFollowings(limit: 10, nextToken: null) {
    items {
      user { id username }
      followedAt
    }
    nextToken
  }
}
```
(Run as Alice)

**Result:**
```json
{
  "items": [
    { "user": { "id": "bob-sub" } },
    { "user": { "id": "charlie-sub" } }
  ],
  "nextToken": null
}
```

**What's different:**
- No GSI needed (uses main table with requesterId = alice-sub)
- Resolver queries main table (not byTarget GSI)
- Returns Alice's followings

---

### Query 3: "Get pending follow requests I received"

```graphql
query {
  getMyPendingFollowRequests {
    items {
      user { id username }
      status
    }
  }
}
```
(Run as Bob)

**Result:**
```json
{
  "items": [
    { "user": { "id": "alice-sub" }, "status": "PENDING" }
  ]
}
```

**What's different:**
- Query byTarget GSI where `targetId = bob-sub AND status = PENDING`
- Same GSI as followers query, but filter by PENDING instead of ACCEPTED

---

### Query 4: "Get all notifications for Bob"

```graphql
query {
  getMyNotifications(limit: 20) {
    items {
      id
      senderId
      type
      createdAt
      read
    }
    nextToken
  }
}
```

**Result:**
```json
{
  "items": [
    { "id": "uuid-1", "senderId": "alice-sub", "type": "FOLLOW_REQUEST_ACCEPTED", "createdAt": "2024-04-23T10:15:00Z" },
    { "id": "uuid-2", "senderId": "alice-sub", "type": "FOLLOW_REQUEST_RECEIVED", "createdAt": "2024-04-23T10:10:00Z" },
    { "id": "uuid-3", "senderId": "charlie-sub", "type": "FOLLOW_REQUEST_RECEIVED", "createdAt": "2024-04-23T10:05:00Z" }
  ],
  "nextToken": null
}
```

**What's happening:**
1. Query BuzzerNotifications table: `recipientId = bob-sub`
2. Sorted by `createdAt` descending (newest first)
3. Limit to 20 items
4. Return with pagination token (if more exist)

**Lesson:** All these queries use partition keys + sort keys + indexes efficiently. No full-table scans!

---

## Exercise 6: Understand Subscriptions (When Implemented)

### Goal
See how real-time updates work.

### Setup (needs to be done once)

1. UI already has subscription code (ui/dashboard.html)
2. Or use GraphQL explorer in AppSync console

### Manual Test

**Step 1: Open AppSync Queries in TWO browser tabs**

**Tab 1 (Bob's browser):**
- Auth: User Pool → Sign in as Bob
- Subscription query:
  ```graphql
  subscription {
    onFollowAccepted(requesterId: "bob-sub") {
      requesterId
      targetId
      status
    }
  }
  ```
- Click "Start subscription"
- Status: `Connected`

**Tab 2 (Alice's browser):**
- Auth: User Pool → Sign in as Alice
- Mutation:
  ```graphql
  mutation {
    acceptFollowRequest(requesterId: "bob-sub") {
      status
    }
  }
  ```
- Click Execute

**Tab 1 (back to Bob):**
- **Instantly** receives in subscription:
  ```json
  {
    "data": {
      "onFollowAccepted": {
        "requesterId": "bob-sub",
        "targetId": "alice-sub",
        "status": "ACCEPTED"
      }
    }
  }
  ```

**What just happened:**
1. Alice's mutation ran (acceptFollowRequest)
2. Mutation resolver updated DynamoDB
3. AppSync checked: are there subscriptions on acceptFollowRequest?
4. Found Bob's subscription with `requesterId: "bob-sub"`
5. Checked filter: `requesterId in mutation result == subscription filter requesterId?`
6. Match! Send message to Bob's WebSocket connection
7. Bob's browser received real-time event

**Key insight:** No polling! WebSocket keeps connection open. When mutation fires, AppSync pushes event to all matching subscriptions.

---

## Exercise 7: Understand Error Handling

### Goal
See what happens when things go wrong and how to debug.

### Scenario 1: DynamoDB condition fails

**Code (Mutation.acceptFollowRequest.js):**
```javascript
condition: {
  expression: "attribute_exists(requesterId) AND #s = :pending",
}
```

**If this fails:**
- You tried to accept a follow request that doesn't exist or isn't PENDING
- DynamoDB returns ConditionalCheckFailedException
- Resolver catches it and returns custom error

**Test it:**
1. Try to accept the same follow request twice
2. First attempt: Success
3. Second attempt:
   ```json
   {
     "errors": [
       {
         "message": "No pending follow request found, or you are not the target user",
         "errorType": "NotFoundOrUnauthorized"
       }
     ]
   }
   ```

---

### Scenario 2: Lambda timeout

**What happens:**
1. Lambda function takes > 60 seconds (default timeout)
2. Lambda execution is killed
3. Error: `Task timed out after 60.00 seconds`
4. SQS message is NOT deleted (implicit retry)
5. SQS redelivers message to Lambda
6. After 3 redeliveries → message in DLQ

**Test it:**
1. Modify notificationProcessor to add delay:
   ```javascript
   await new Promise(r => setTimeout(r, 70000)); // 70 seconds
   ```
2. Deploy
3. Call requestFollow
4. Watch Lambda timeout in CloudWatch logs
5. Message retried automatically

---

### Scenario 3: AppSync timeout

**What happens:**
1. Resolver calls DynamoDB (or Lambda) but doesn't respond
2. AppSync waits for response (default 30 seconds)
3. AppSync times out
4. Client receives error

**In code:**
- You configure timeout when creating data source
- Default: 30 seconds
- Can increase but costs more (Lambda/DynamoDB waiting)

---

## Exercise 8: Learn the Codebase Structure

### Goal
Navigate the code and understand how it's organized.

### Directory structure (reminder):
```
Buzzer-Task/
├── README.md (overview of deployment)
├── amplify/
│   └── backend/
│       ├── api/buzzertask/
│       │   ├── schema.graphql (GraphQL types + operations)
│       │   ├── resolvers/ (individual resolver JS files)
│       │   │   ├── Mutation.requestFollow.js
│       │   │   ├── Mutation.requestFollow.SQS.js
│       │   │   ├── Query.getMyFollowers.js
│       │   │   ├── Subscription.onFollowAccepted.js
│       │   │   └── ... (others)
│       │   └── stacks/CustomResources.json (CloudFormation for tables, SQS, Lambda)
│       ├── function/
│       │   ├── postConfirmationTrigger/ (Lambda source)
│       │   │   └── src/index.mjs
│       │   └── notificationProcessor/ (Lambda source)
│       │       └── src/index.mjs
│       └── auth/
│           └── buzzertaskcc0bb83c/
│               ├── overrides.ts (Cognito config, trigger attachment)
├── src/graphql/ (manually written GraphQL queries for testing)
├── test/run-demo.mjs (end-to-end test script)
└── ui/ (static HTML UI + sample queries)
```

### Key files to understand:

**1. schema.graphql** (API contract)
- Read this first to understand what operations exist
- All types are defined here
- All mutations/queries/subscriptions listed

**2. Mutation.requestFollow.js** (first resolver)
- Request: validates and builds DynamoDB write
- Response: returns result
- Shows how to access identity: `ctx.identity.sub`

**3. Mutation.requestFollow.SQS.js** (second resolver in pipeline)
- Publishes event to SQS queue
- Doesn't error if SQS fails (appends error instead)

**4. postConfirmationTrigger/index.mjs** (Lambda source)
- Triggered after Cognito email confirmation
- Writes user profile to DynamoDB
- Shows idempotency pattern (ConditionExpression)

**5. notificationProcessor/index.mjs** (Lambda source)
- Consumes SQS messages
- Calls AppSync with IAM authentication
- Shows SigV4 signing for IAM requests

**6. CustomResources.json** (Infrastructure as Code)
- CloudFormation template
- Defines all DynamoDB tables, SQS queue, Lambda policies
- Shows how resources are connected

**7. overrides.ts** (Cognito customization)
- Attaches post-confirmation Lambda trigger
- Sets Cognito user attributes

### Study order (recommend):
1. schema.graphql (understand API)
2. run-demo.mjs (understand flow)
3. Mutation.requestFollow.js + SQS.js (understand mutation pipeline)
4. postConfirmationTrigger/index.mjs (understand signup flow)
5. notificationProcessor/index.mjs (understand async notifications)
6. CustomResources.json (understand infrastructure)
7. Query.getMyFollowers.js (understand GSI queries)
8. Subscription.onFollowAccepted.js (understand real-time auth)

---

## Exercise 9: Add a New Field to User Profile

### Goal
Practice making schema changes and deploying.

### Task
Add `bio` (biography) field to User type.

### Step 1: Update schema
Edit `amplify/backend/api/buzzertask/schema.graphql`:

**Before:**
```graphql
type User {
  id: ID!
  username: String!
  email: AWSEmail!
  displayName: String
  avatarUrl: AWSURL
  createdAt: AWSDateTime!
}
```

**After:**
```graphql
type User {
  id: ID!
  username: String!
  email: AWSEmail!
  displayName: String
  avatarUrl: AWSURL
  bio: String  # ← New field
  createdAt: AWSDateTime!
}
```

### Step 2: Deploy
```bash
amplify push
```

Amplify will:
- Detect schema change
- Regenerate resolvers (if using Amplify data model)
- Deploy updated schema to AppSync

### Step 3: Test
```bash
# Query with new field
query {
  getMyProfile {
    id
    username
    bio  # ← Should work now
  }
}
```

### Step 4: Update Lambda to populate it

Edit `amplify/backend/function/postConfirmationTrigger/src/index.mjs`:

**Before:**
```javascript
await client.send(
  new PutItemCommand({
    TableName: TABLE_NAME,
    Item: marshall({
      id: sub,
      email,
      username,
      displayName: name || username,
      createdAt: new Date().toISOString(),
    }),
    ...
  })
);
```

**After:**
```javascript
await client.send(
  new PutItemCommand({
    TableName: TABLE_NAME,
    Item: marshall({
      id: sub,
      email,
      username,
      displayName: name || username,
      bio: "",  // ← Empty bio on signup
      createdAt: new Date().toISOString(),
    }),
    ...
  })
);
```

### Step 5: Deploy and test
```bash
amplify push
node test/run-demo.mjs
```

**Reflection:**
- How would you add a mutation to UPDATE the bio?
- Who should be able to update bio? (Only the user themselves)
- How would you add authorization to prevent others from updating your bio?

---

## Exercise 10: Deep Dive into One Resolver

### Goal
Fully understand one resolver end-to-end.

### Pick: Query.getMyFollowers

### Read the code
File: `amplify/backend/api/buzzertask/resolvers/Query.getMyFollowers.js`

```javascript
export function request(ctx) {
  const callerId = ctx.identity.sub;

  return {
    operation: "Query",
    index: "byTarget",
    query: {
      expression: "targetId = :me AND #s = :accepted",
      expressionNames: { "#s": "status" },
      expressionValues: {
        ":me": { S: callerId },
        ":accepted": { S: "ACCEPTED" },
      },
    },
    limit: ctx.args.limit ?? 20,
    nextToken: ctx.args.nextToken ?? null,
    scanIndexForward: false,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const items = (ctx.result.items ?? []).map((item) => ({
    user: { id: item.requesterId },
    followedAt: item.updatedAt,
    status: item.status,
  }));

  return {
    items,
    nextToken: ctx.result.nextToken ?? null,
  };
}
```

### Understand each part

**Line: `const callerId = ctx.identity.sub;`**
- Gets the authenticated user's ID from JWT token
- JWT is validated by AppSync before resolver runs
- ctx.identity.sub is a Cognito-specific claim

**Line: `operation: "Query"`**
- Tells DynamoDB we're querying (not scanning, not getting single item)

**Line: `index: "byTarget"`**
- Uses the GSI we defined
- GSI has PK=targetId, SK=requesterId
- Allows efficient lookup of "who follows me"

**Line: `expression: "targetId = :me AND #s = :accepted"`**
- targetId = :me: Find records where targetId equals my ID
- #s = :accepted: Only include records where status is ACCEPTED
- Uses parameter substitution (:me, #s) to prevent injection

**Line: `expressionNames: { "#s": "status" }`**
- Maps placeholder `#s` to actual field name `status`
- Why? "status" is reserved keyword in DynamoDB; must escape

**Line: `expressionValues: { ":me": { S: callerId }, ":accepted": { S: "ACCEPTED" } }`**
- Maps :me to the actual value (my user ID)
- Maps :accepted to "ACCEPTED"
- { S: value } means String type in DynamoDB

**Line: `limit: ctx.args.limit ?? 20`**
- Use client-provided limit, or default to 20
- Prevents client from requesting 1 million items

**Line: `scanIndexForward: false`**
- Sort order of results
- false = descending (newest first)
- true = ascending (oldest first)

**Response function:**
```javascript
const items = (ctx.result.items ?? []).map((item) => ({
  user: { id: item.requesterId },
  followedAt: item.updatedAt,
  status: item.status,
}));
```

- DynamoDB returns raw items: { requesterId, targetId, status, updatedAt }
- Transform to GraphQL type: { user: { id }, followedAt, status }
- Maps DynamoDB field names to GraphQL field names (updatedAt → followedAt)
- Returns paginated connection object

### Questions to answer:

1. **Why does this query need authorization?**
   - Answer: `@aws_cognito_user_pools` decorator requires JWT token
   - User can only see their own followers (filtered by targetId=:me)

2. **What if callerId is null?**
   - Answer: GraphQL decorator would have blocked request earlier
   - If someone somehow bypassed it, query would look for targetId=null (no results)

3. **What if you removed `#s = :accepted`?**
   - Answer: Query would return both ACCEPTED and PENDING follows
   - User would see pending requests from people who haven't been accepted yet

4. **Why use GSI instead of querying main table?**
   - Answer: Main table PK is requesterId
   - To find followers, you'd need targetId
   - Without GSI, you'd scan entire table and filter in memory (slow)
   - With GSI, query is direct (fast)

5. **What happens if a user has 1 million followers?**
   - Answer: Query returns first 20 (default limit)
   - Returns nextToken for pagination
   - Client must loop and fetch next 20, then next 20, etc.
   - Prevents overwhelming single response

---

## Challenge: Create Your Own Mutation

### Goal
Prove you understand the system by adding a new mutation.

### Challenge
Add `unfollowUser(userId: ID!): Boolean` mutation

**Requirements:**
1. Only unfollowed accepted follows (not pending)
2. Cannot unfollow yourself
3. Should update DynamoDB Follow record to status = UNFOLLOWED
4. Should create a notification (via SQS)
5. Should be protected with @aws_cognito_user_pools

### Your steps:
1. Add mutation to schema
2. Create Mutation.unfollowUser.js resolver
3. Create Mutation.unfollowUser.SQS.js resolver
4. Update notificationProcessor to handle FOLLOW_UNFOLLOWED type
5. Deploy and test
6. Verify: DynamoDB has updated Follow, Notification created

**Bonus:** Add subscription for unfollow events

---

## Next Steps

Once you've completed these exercises, you're ready for:
1. Adding OpenSearch integration (bonus task)
2. Interview discussions about architecture
3. Extending the system with new features
4. Debugging production issues

Keep this guide handy and refer back to it as needed!

