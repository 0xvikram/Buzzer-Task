# Buzzer Task: Interview Preparation Guide

This document contains the most likely questions an interviewer will ask about this codebase, along with detailed answers you should be able to explain.

---

## Q1: "Walk us through your data model. Why did you structure it that way?"

### Answer Structure:

**I have 3 main tables:**

1. **BuzzerUsers Table**
   - Primary Key: `id` (Cognito sub)
   - Stores: email, username, displayName, avatarUrl
   - Purpose: User profile storage (separate from Cognito)
   - Why separate: Cognito is the identity provider; DynamoDB is the application data store. This separation lets me store additional profile data, query users for mentions, search, etc., without relying on Cognito APIs which have rate limits.

2. **BuzzerFollows Table**
   - Composite Primary Key:
     - Partition Key: `requesterId` (who sent the request)
     - Sort Key: `targetId` (who received it)
   - Attributes: `status` (PENDING/ACCEPTED), `createdAt`, `updatedAt`
   - **Global Secondary Index (byTarget):**
     - PK: `targetId`
     - SK: `requesterId`
     - Purpose: Efficient reverse lookups
   - Why this design:
     - **Direct access:** Query by requester (Alice → "who do I follow?")
     - **Reverse access:** Query by target via GSI (Bob → "who follows me?")
     - Both O(1) with respect to total followers count (not full table scan)

3. **BuzzerNotifications Table**
   - Composite Primary Key:
     - Partition Key: `recipientId` (who gets the notification)
     - Sort Key: `createdAt` (time-ordered)
   - Attributes: `id`, `senderId`, `type`, `read`
   - Why this design:
     - **Access pattern:** "Get my notifications" queries by recipientId
     - **Ordering:** Sort by createdAt for latest-first chronological queries
     - **Idempotency:** `id` (UUID) ensures duplicate SQS messages don't create duplicate notifications

**Access Patterns:**
```
- getMyFollowers: Query byTarget GSI where targetId=:me AND status=ACCEPTED
- getMyFollowings: Query main table where requesterId=:me AND status=ACCEPTED
- getMyPendingRequests: Query byTarget where targetId=:me AND status=PENDING
- getMyNotifications: Query main table where recipientId=:me, sort by createdAt DESC
```

---

## Q2: "Explain your authorization strategy. How do you prevent a user from accessing another user's data?"

### Answer Structure:

**I use a 3-layer authorization model:**

**Layer 1: GraphQL Decorator (`@aws_cognito_user_pools`)**
```graphql
type Query {
  getMyFollowers(limit: Int): FollowConnection @aws_cognito_user_pools
}
```
- Requires valid JWT token from Cognito
- User identity available as `ctx.identity.sub`
- Blocks unauthenticated requests at API boundary

**Layer 2: Storage-Layer Enforcement (DynamoDB Conditions)**
Example: `acceptFollowRequest` mutation
```javascript
export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { requesterId } = ctx.args;

  return {
    operation: "UpdateItem",
    key: {
      requesterId: { S: requesterId },
      targetId: { S: callerId },  // ← Only THIS user can update
    },
    condition: {
      expression: "attribute_exists(requesterId) AND #s = :pending",
      expressionNames: { "#s": "status" },
      expressionValues: { ":pending": { S: "PENDING" } },
    },
  };
}
```
**Why this is strong:** If another user tries to call acceptFollowRequest with a different targetId, DynamoDB will return ConditionalCheckFailedException because their `callerId` won't match the stored `targetId`. This is **enforced at the storage layer**, not just in application code.

**Layer 3: Manual Business Logic Checks**
Example: `requestFollow` validation
```javascript
if (callerId === targetUserId) {
  util.error("Cannot follow yourself", "ValidationError");
}
```
- Prevents nonsensical operations (self-follows, self-unfollows)
- Client-side validation would be insufficient because clients are untrusted

**IAM Authorization for Internal Mutations**
```graphql
type Mutation {
  createNotificationInternal(input: CreateNotificationInput!): Notification @aws_iam
}
```
- Only AWS services with IAM role can call this
- Lambda's execution role is granted permission
- No JWT-holding client can call it, even if they somehow know the mutation name
- Prevents users from faking notifications to themselves

**Why three layers?**
- Layer 1 catches missing auth early
- Layer 2 prevents authorization bypass at data level
- Layer 3 handles business rules

---

## Q3: "Why did you use SQS instead of writing notifications directly from the mutation?"

### Answer Structure:

**The problem with inline creation:**
```
requestFollow mutation
  ↓
DynamoDB: write follow record
  ↓
DynamoDB: write notification directly
  ↓
If notification write fails → entire mutation fails
  ↓
User's follow request is lost/rolled back
```
User experience: "I sent the follow request but got an error. I don't know if it went through."

**The solution with SQS:**
```
requestFollow mutation
  ↓
DynamoDB: write follow record ✓
  ↓
SQS: queue notification event (returns immediately) ✓
  ↓
Return success to user ✓
  ↓
[Async] Lambda consumes message
  ↓
[Async] Lambda creates notification
  ↓
If Lambda fails → SQS retries (3 times by default)
  ↓
After retries → message goes to DLQ (Dead Letter Queue)
  ↓
CloudWatch alarm → ops team investigates
```
User experience: "Follow request went through! Notifications are processing in the background."

**Additional benefits:**
1. **Decoupling:** Follow logic doesn't depend on notification system. If OpenSearch needs to be updated in the future, that's another consumer on the same queue.
2. **Scalability:** If notification creation becomes slow, SQS buffers messages. Lambda can scale independently.
3. **Retry semantics:** SQS handles retries and DLQ automatically. Manual error handling is minimal.
4. **Idempotency:** Each notification has a UUID; even if Lambda processes the same SQS message twice, DynamoDB's `attribute_not_exists(id)` prevents duplicates.

**Why not step functions or other orchestration?**
- SQS is simpler for this use case (single async step)
- Step Functions add complexity if no branching/timing needed
- SQS has built-in DLQ, simpler monitoring

---

## Q4: "How do GraphQL subscriptions work in your app? Walk me through the real-time flow."

### Answer Structure:

**High-level flow:**
```
Client 1 (Bob) establishes subscription
  ↓
WebSocket connection to AppSync
  ↓
Listening for: onFollowAccepted(requesterId: "alice-id")
  ↓
[Client 2] Alice accepts Bob's follow request
  ↓
AppSync mutation: acceptFollowRequest fires
  ↓
Mutation resolver updates DynamoDB ✓
  ↓
Subscription trigger: @aws_subscribe(mutations: ["acceptFollowRequest"])
  ↓
AppSync checks: does this mutation match subscription filter?
  ↓
Subscription filter logic (see next):
```

**Filter authorization (preventing cross-user message leakage):**
```javascript
// Subscription.onFollowAccepted.js
export function request(ctx) {
  const callerId = ctx.identity.sub;
  const { requesterId: subscriptionRequesterId } = ctx.args;

  // ← Auth: user can only subscribe to their own follow acceptances
  if (callerId !== subscriptionRequesterId) {
    util.error("Cannot subscribe to another user's follow acceptances", "Unauthorized");
  }

  return ctx.request;
}
```
**Why this matters:** Without this filter, Bob could subscribe to `onFollowAccepted(requesterId: "alice-id")` and spy on Alice's follow events.

**With the check:** Bob can only subscribe to events where he's the requester.

**Flow continues:**
```
AppSync checks filter:
  callerId = Bob's sub = "bob-id"
  subscriptionRequesterId from filter = "bob-id"
  Check: "bob-id" === "bob-id" ✓
  
Filter passes → AppSync sends mutation result to Bob's WebSocket connection:
{
  "data": {
    "onFollowAccepted": {
      "requesterId": "bob-id",
      "targetId": "alice-id",
      "status": "ACCEPTED",
      "createdAt": "2024-04-23T10:00:00Z"
    }
  }
}

Bob's client receives event in real-time ✓
```

**Subscription implementation detail:**
```graphql
type Subscription {
  onFollowAccepted(requesterId: ID!): Follow
    @aws_subscribe(mutations: ["acceptFollowRequest"])
    @aws_cognito_user_pools
}
```
- `@aws_subscribe(mutations: ["acceptFollowRequest"])` — subscribe to this mutation
- `@aws_cognito_user_pools` — requires JWT token to establish subscription
- AppSync manages WebSocket connections; subscriptions are fan-out based on filters

**Real-world caveat:**
- Subscriptions are **not persistent** — if client disconnects, subscription is lost
- Must re-establish on reconnect (handled by Apollo Client, Amplify client, etc.)
- For durable notifications, always have a `getMyNotifications` query as fallback

---

## Q5: "How do you handle authorization in the notificationProcessor Lambda?"

### Answer Structure:

**The Lambda calls AppSync via IAM (SigV4 signing):**

```javascript
// notificationProcessor/index.mjs
async function callAppSyncIAM(query, variables) {
  const signer = new SignatureV4({
    credentials: defaultProvider(),  // ← Uses Lambda execution role
    region: REGION,
    service: "appsync",
    sha256: Sha256,
  });

  const signed = await signer.sign({
    method: "POST",
    hostname: url.hostname,
    path: url.pathname,
    headers: { "Content-Type": "application/json", host: url.hostname },
    body,
  });

  // signed.headers includes AWS SigV4 signature
  const response = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: signed.headers,  // ← AWS can verify this is from Lambda role
    body,
  });
}
```

**Why IAM instead of hardcoded API key?**

1. **No secrets management:** Don't need to store an API key in Lambda environment or Secrets Manager. The Lambda role is automatically granted permission.
2. **Auditability:** CloudTrail logs show which role made the call.
3. **Least privilege:** Can grant specific AppSync mutations (e.g., only `createNotificationInternal`) to this role.

**IAM role configuration (in CloudFormation):**
```json
{
  "Type": "AWS::IAM::Role",
  "Properties": {
    "AssumeRolePolicyDocument": {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": { "Service": "lambda.amazonaws.com" },
          "Action": "sts:AssumeRole"
        }
      ]
    }
  }
}
```

**Inline policy (allows calling AppSync):**
```json
{
  "Effect": "Allow",
  "Action": "appsync:GraphQL",
  "Resource": "arn:aws:appsync:REGION:ACCOUNT:apis/API_ID/*"
}
```

**AppSync resolver sees IAM auth:**
```javascript
// Mutation.createNotificationInternal.js
export function request(ctx) {
  // ctx.identity.accountId = calling AWS account
  // ctx.identity.cognitoIdentityId = (not applicable for IAM)
  // ctx.requestId = request tracking ID
  
  // No manual auth needed here; @aws_iam decorator handles it
  // But we could add extra checks if needed:
  if (!ctx.identity.accountId) {
    util.error("Not called with IAM role", "Unauthorized");
  }
}
```

---

## Q6: "How do you ensure notifications are idempotent when SQS might deliver the same message twice?"

### Answer Structure:

**SQS delivery guarantee:**
- SQS guarantees **at-least-once** delivery, not exactly-once
- Network failures, Lambda retries, etc. → same message can be processed twice
- DLQ appears after max retries, but message might already be processed

**Idempotency in your code:**

**Step 1: Generate UUID for each notification**
```javascript
const input = {
  id: randomUUID(),  // ← Unique per notification, not per SQS message
  recipientId,
  senderId,
  type,
};
```

**Step 2: DynamoDB condition prevents duplicates**
```javascript
// Mutation.createNotificationInternal.js
return {
  operation: "PutItem",
  key: { id },
  attributeValues: { ... },
  condition: {
    expression: "attribute_not_exists(id)",  // ← Fail if ID already exists
  },
};
```

**Flow:**
```
SQS Message arrives (first time)
  ↓
Lambda generates UUID "abc123" and calls AppSync
  ↓
AppSync: PutItem where id="abc123"
  ↓
DynamoDB: attribute_not_exists("abc123") ✓
  ↓
Item created, Lambda returns success
  ↓
SQS message deleted ✓

[Network glitch] SQS retries same message
  ↓
Lambda generates NEW UUID "def456" and calls AppSync
  ↓
Wait, this would create a SECOND notification...
```

**Ah! The UUID approach actually creates duplicate notifications for retries.**

**Better approach: Use SQS MessageDeduplicationId (if FIFO queue)**
OR
**Use a deterministic ID based on the event:**
```javascript
const notificationId = `${senderId}#${recipientId}#${type}#${timestamp}`;
const input = { id: notificationId, ... };
```
But this has issues too (what if two follows happen in same millisecond?).

**The pragmatic solution (what your code actually does):**
```javascript
// Each SQS message body already has a senderId, recipientId, type, timestamp
// If the same follow request is created, SQS will send the same message again
// But: the Follow record is also idempotent (requesterId+targetId is unique key)

// So worst case: a notification is created twice
// But: this is rare and eventually consistent — notifications are fire-and-forget
// If you need strict idempotency: use SQS FIFO + MessageDeduplicationId
```

**For production, you'd want:**
```json
{
  "QueueName": "BuzzerNotificationQueue.fifo",
  "FifoQueue": true,
  "ContentBasedDeduplication": true,
  "MessageRetentionPeriod": 86400
}
```
FIFO queues deduplicate based on `MessageDeduplicationId`. Set it to a deterministic hash of the event.

---

## Q7: "Walk me through the entire signup and login flow."

### Answer Structure:

**Signup:**
```
1. User fills form: email, password, username
2. Client calls Cognito SignUp API
   {
     "ClientId": "your-client-id",
     "Username": "alice@example.com",
     "Password": "SecurePassword123",
     "UserAttributes": [
       { "Name": "email", "Value": "alice@example.com" },
       { "Name": "preferred_username", "Value": "alice" },
       { "Name": "name", "Value": "Alice Smith" }
     ]
   }

3. Cognito stores user in User Pool (encrypted passwords, etc.)
   Returns: UserSub, CodeDeliveryDetails (email sent)

4. User receives email: "Your verification code is: 123456"

5. Client calls Cognito ConfirmSignUp:
   {
     "ClientId": "your-client-id",
     "Username": "alice@example.com",
     "ConfirmationCode": "123456"
   }

6. Cognito verifies code → marks user as CONFIRMED

7. Cognito fires Post-Confirmation Lambda trigger
   Event:
   {
     "request": {
       "userAttributes": {
         "sub": "550e8400-e29b-41d4-a716-446655440000",
         "email": "alice@example.com",
         "preferred_username": "alice",
         "name": "Alice Smith"
       }
     }
   }

8. Your postConfirmationTrigger Lambda executes:
   - Extracts sub, email, username, name
   - Calls DynamoDB PutItem:
     {
       "TableName": "BuzzerUsers-dev",
       "Item": {
         "id": { "S": "550e8400-e29b-41d4-a716-446655440000" },
         "email": { "S": "alice@example.com" },
         "username": { "S": "alice" },
         "displayName": { "S": "Alice Smith" },
         "createdAt": { "S": "2024-04-23T10:00:00Z" }
       },
       "ConditionExpression": "attribute_not_exists(id)"
     }
   - Item created in DynamoDB ✓
   - Lambda returns event → user activation complete ✓
```

**Login:**
```
1. User enters email + password in UI

2. Client calls Cognito InitiateAuth:
   {
     "ClientId": "your-client-id",
     "AuthFlow": "USER_PASSWORD_AUTH",
     "AuthParameters": {
       "USERNAME": "alice@example.com",
       "PASSWORD": "SecurePassword123"
     }
   }

3. Cognito validates credentials → generates tokens:
   {
     "AuthenticationResult": {
       "AccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "IdToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "RefreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "ExpiresIn": 3600
     }
   }

4. Client stores tokens (localStorage, secure storage):
   - IdToken: claims about user (sub, email, groups)
   - AccessToken: used to call GraphQL API
   - RefreshToken: used to get new tokens when expired

5. Client calls GraphQL API:
   POST /graphql HTTP/1.1
   Authorization: Bearer <IdToken>
   
   query GetMyProfile {
     getMyProfile {
       id
       username
       email
     }
   }

6. AppSync receives request:
   - Extracts IdToken from Authorization header
   - Validates signature against Cognito public keys
   - Extracts claims → ctx.identity.sub = "550e8400-e29b-41d4-a716-446655440000"
   - Checks decorator @aws_cognito_user_pools ✓
   - Invokes resolver

7. Query.getMyProfile resolver:
   Queries DynamoDB: GET BuzzerUsers where id=:callerId
   Returns user profile ✓
```

**Token expiry and refresh:**
```
AccessToken expires after 3600 seconds (1 hour)
Client gets 401 Unauthorized from AppSync

Client calls Cognito InitiateAuth (REFRESH_TOKEN_AUTH):
{
  "ClientId": "your-client-id",
  "AuthFlow": "REFRESH_TOKEN_AUTH",
  "AuthParameters": {
    "REFRESH_TOKEN": "<stored refresh token>"
  }
}

Cognito validates refresh token → issues new AccessToken (and IdToken)
Client retries original request with new token
Request succeeds ✓
```

**Why separate IdToken and AccessToken?**
- IdToken: User identity claims (sub, email, groups) — used for authorization
- AccessToken: Proof of authentication — used internally by Cognito for token validation

---

## Q8: "How would you add the OpenSearch integration for searching followers?"

### Answer Structure:

**Architecture:**
```
User searches "alice" in their followers
  ↓
GraphQL Query: searchFollowers(query: "alice")
  ↓
AppSync resolver calls OpenSearch (IAM auth)
  ↓
OpenSearch queries followers index
  ↓
Returns matching User objects
  ↓
AppSync returns to client
```

**Key challenges:**

1. **Only search MY followers, not all users**
   - DynamoDB: requesterId=:me (already have this)
   - Problem: OpenSearch doesn't know which users are my followers
   - Solution: Index only the Follows records + enrich with User data

2. **Sync DynamoDB → OpenSearch**
   - DynamoDB Streams trigger Lambda on every insert/update/delete
   - Lambda indexes to OpenSearch
   - Handle failures: DynamoDB Streams DLQ

3. **Query structure in OpenSearch**
   ```
   {
     "query": {
       "bool": {
         "must": [
           { "match": { "username": "alice" } },  // ← text search
           { "term": { "targetId.keyword": "<my_id>" } },  // ← my followers only
           { "term": { "status.keyword": "ACCEPTED" } }
         ]
       }
     }
   }
   ```

4. **Authorization at AppSync level**
   ```javascript
   // Query.searchFollowers
   export function request(ctx) {
     const callerId = ctx.identity.sub;
     const { query } = ctx.args;
     
     // Build OpenSearch query that filters by targetId=callerId
     // Never expose targetId to client input
     const opensearchQuery = {
       query: {
         bool: {
           must: [
             { match: { "username": query } },
             { term: { "targetId.keyword": callerId } },
             { term: { "status.keyword": "ACCEPTED" } }
           ]
         }
       }
     };
     
     return {
       method: "POST",
       resourcePath: "/_search",
       params: { body: JSON.stringify(opensearchQuery) }
     };
   }
   ```

**Implementation steps:**
1. Create OpenSearch domain (t3.small, 2 nodes, 1 replica)
2. Create `followers_index` with mappings: requesterId, targetId, status, username, email, displayName
3. Add DynamoDB Stream trigger on Follows table
4. Lambda consumes stream → upserts to OpenSearch
5. Add AppSync data source for OpenSearch HTTP endpoint
6. Add Query.searchFollowers resolver with IAM auth

---

## Q9: "What's the worst thing that could happen in your current architecture?"

### Answer Structure:

**Critical failure scenarios:**

1. **DynamoDB is down**
   - Mutations fail immediately
   - Users can't login, make requests, etc.
   - Mitigation: DynamoDB is multi-AZ by default; very rare
   - Recovery: AWS will restore; nothing you do manually

2. **AppSync is unavailable**
   - Entire API is down
   - Mitigation: AppSync has 99.99% SLA
   - You rely on AWS here

3. **Lambda (notificationProcessor) dies in a loop**
   - Keeps retrying message, always failing
   - After 3 retries → message goes to DLQ
   - Mitigation: CloudWatch alarms on Lambda errors, DLQ depth
   - Recovery: Fix Lambda code, replay DLQ messages

4. **Cognito password reset email not delivered**
   - User locked out
   - Mitigation: Cognito uses SNS → SES for emails; check quotas
   - Recovery: AWS support resets, or add admin reset flow

5. **Notification Lambda is slow**
   - Follows get recorded, but users don't see real-time notification for 10 minutes
   - SQS backlog grows
   - Mitigation: Lambda timeout too short? Increase. AppSync endpoint down? Check.
   - Recovery: Scale Lambda concurrency, monitor CloudWatch

6. **Duplicate followers due to race condition**
   - Alice requests follow at exact same time as herself (clock skew?)
   - Both requests hit DynamoDB before either completes
   - Mitigation: DynamoDB condition `attribute_not_exists(requesterId) AND attribute_not_exists(targetId)` prevents this
   - Already handled!

7. **Subscription connection dies silently**
   - Bob's WebSocket to AppSync disconnects
   - Accept notification never reaches him
   - Mitigation: Client SDK handles reconnection; but user must refresh
   - Solution: Always have getMyNotifications query as a fallback

**Most likely issue you'd encounter:**
- **SQS message processing slow or failing**
- **Cognito user pool throttled** (too many signup attempts)
- **DynamoDB burst capacity exhausted** (spike in traffic)

---

## Q10: "How would you handle multi-tenancy in this system?"

### Answer Structure:

**Current single-tenant setup:**
- All users in one Cognito pool
- All data in one DynamoDB account
- One AppSync API

**For multi-tenant (different organizations):**

**Option 1: Database-per-tenant (most isolation)**
```
Tenant A: buzzertask-tenant-a
  - Cognito pool
  - DynamoDB tables
  - AppSync API
  - Separate Lambda functions

Tenant B: buzzertask-tenant-b
  - Cognito pool
  - DynamoDB tables
  - AppSync API
  - Separate Lambda functions
```
Pros: Complete isolation, can scale independently
Cons: 10x infrastructure cost, complex deployment

**Option 2: Schema-per-tenant (shared infrastructure)**
```
All data in same DynamoDB, but partitioned by tenantId:

BuzzerUsers table:
  tenantId (PK)
  userId (SK)
  ...other fields

BuzzerFollows table:
  tenantId (PK)
  followKey (SK) = requesterId#targetId
  ...

GSI (byTargetPerTenant):
  PK: tenantId
  SK: targetId
```
All queries include `tenantId` filter
Pros: Shared cost, easier ops
Cons: Risk of data leakage if you forget tenantId filter

**Option 3: Separate Cognito pools, shared data**
```
Tenant A: Cognito pool A → AppSync API → Shared DynamoDB (filtered by tenantId)
Tenant B: Cognito pool B → AppSync API → Shared DynamoDB (filtered by tenantId)
```

**How to prevent data leakage in Option 2:**
```javascript
export function request(ctx) {
  const callerId = ctx.identity.sub;
  const tenantId = ctx.identity["custom:tenantId"];  // ← Custom claim in Cognito
  
  // Always include tenant filter
  return {
    operation: "Query",
    index: "byTargetPerTenant",
    query: {
      expression: "tenantId = :tid AND targetId = :me",
      expressionValues: {
        ":tid": { S: tenantId },
        ":me": { S: callerId },
      },
    },
  };
}
```

**My recommendation for you:**
- Current single-tenant is fine for an MVP or single organization
- If you need multi-tenant, Option 2 (schema-per-tenant) is least expensive
- Always put tenantId in the PK to avoid accidents

---

## Q11: "What monitoring and observability do you have?"

### Answer Structure:

**Currently in the code:**
```javascript
console.log(`[postConfirmationTrigger] Created user record for sub=${sub}`);
```

**CloudWatch integration (automatic):**
- Lambda logs → `/aws/lambda/postConfirmationTrigger` (CloudWatch Logs)
- AppSync resolver logs → `/aws/appsync/<api-id>` (if enabled)
- DynamoDB metrics → CloudWatch Metrics (read/write units, throttling)
- SQS metrics → CloudWatch Metrics (messages, age, DLQ)

**What you should add:**
1. **CloudWatch Alarms**
   - Lambda error rate > 1% → alert
   - SQS DLQ depth > 10 → alert
   - DynamoDB throttling → alert

2. **Structured logging**
   ```javascript
   console.log(JSON.stringify({
     timestamp: new Date().toISOString(),
     service: "notificationProcessor",
     level: "INFO",
     userId: recipientId,
     notificationType: type,
     duration_ms: Date.now() - startTime,
   }));
   ```

3. **X-Ray tracing**
   - Enable X-Ray on AppSync → see resolver latency
   - Enable X-Ray on Lambda → see DynamoDB + AppSync call latency
   - Trace end-to-end request flow

4. **Dashboards**
   - Custom CloudWatch dashboard:
     - AppSync mutation latency (p50, p95, p99)
     - Lambda duration (SQS consumer)
     - DynamoDB throttling events
     - User signup rate
     - Follow request rate

---

## Q12: "What would you do differently if you were redesigning this?"

### Answer Structure:

**Things I'd keep:**
- DynamoDB (great for this access pattern)
- Cognito + AppSync (native integration, serverless)
- SQS → Lambda for async processing (good decoupling)
- DynamoDB table design with GSIs (efficient querying)

**Things I'd improve:**

1. **GraphQL Subscriptions → WebSocket connection pooling**
   - Current: Each client has 1 WebSocket connection
   - For 10k concurrent users: 10k WebSocket connections = $$
   - Improvement: Use SQS → SNS → WebSocket broadcast (AWS Managed Messaging)
   - Or: Use Apollo Server with subscriptions-transport-ws (self-hosted gateway)

2. **Notifications → Message broker instead of SQS**
   - Current: SQS (simple, but no fan-out)
   - Improvement: SNS → multiple consumers (notifications, analytics, OpenSearch sync)
   - Example: Follow request → SNS → [Lambda for notifications, Lambda for analytics, Lambda for search index]

3. **DynamoDB → Add stream consumer for auditing**
   - Track all changes for compliance
   - Current: No audit log

4. **Lambda → Add explicit error budgets**
   - Current: Silently retries with SQS
   - Improvement: CloudWatch alarms + PagerDuty integration

5. **AppSync Resolver → Use AppSync Amplify Data Model**
   - Current: Manual VTL resolvers
   - Improvement: Use Amplify GraphQL Transform directives (@model, @auth, @function)
   - Caveat: Less control, but faster iteration

6. **Testing → Add integration tests**
   - Current: Manual test script (run-demo.mjs)
   - Improvement: Automated tests with Jest + AWS SDK mock
   - Test: auth edge cases, race conditions, async failures

---

## Q13: "How do you test this locally?"

### Answer Structure:

**Your current testing setup:**
```bash
# 1. Deploy to AWS
amplify push --allow-destructive-graphql-schema-updates

# 2. Run end-to-end test
node test/run-demo.mjs

# 3. Manual UI testing
npx serve ui
# Open browser, interact with UI manually
```

**What the test does:**
1. Signs up 2 users (Alice, Bob) in Cognito
2. Gets auth tokens
3. Alice sends follow request
4. Bob accepts
5. Queries followers/followings
6. Asserts Alice in Bob's followers, Bob in Alice's followings

**Limitations:**
- Doesn't test subscriptions (real-time)
- Doesn't test Lambda failures
- Doesn't test DynamoDB throttling
- Manual UI testing is tedious

**What you should add:**
1. **Unit tests for resolvers:**
   ```javascript
   // __tests__/resolvers/Mutation.requestFollow.test.js
   import { request, response } from "../Mutation.requestFollow.js";
   
   test("rejects self-follow", () => {
     const ctx = {
       identity: { sub: "user-1" },
       args: { targetUserId: "user-1" },
       error: null,
     };
     expect(() => request(ctx)).toThrow("Cannot follow yourself");
   });
   ```

2. **Integration tests with LocalStack:**
   ```bash
   # LocalStack = local AWS emulator
   # Run DynamoDB, SQS, Cognito locally
   docker-compose up -d localstack
   
   # Run tests against LocalStack (no AWS charges!)
   DYNAMODB_ENDPOINT=http://localhost:4566 node test/integration.mjs
   ```

3. **Subscription tests with WebSocket client:**
   ```javascript
   import { WebSocketClient } from "@aws-amplify/api";
   
   const client = new WebSocketClient({ endpoint: appSyncUrl });
   const unsub = client.subscribe({
     query: subscriptionQuery,
     variables: { recipientId: "bob-id" },
     onNext: (data) => { /* assert notification received */ },
   });
   
   // Trigger mutation from another connection
   // Assert onNext fires
   ```

---

## Q14: "What are your biggest security concerns?"

### Answer Structure:

**Current security measures:**
1. ✅ Cognito JWT for user auth
2. ✅ IAM role for Lambda (no hardcoded credentials)
3. ✅ DynamoDB storage-layer enforcement (conditions)
4. ✅ Subscription filtering (can't subscribe to other user's events)

**Remaining concerns:**

1. **Subscription Authorization Bypass**
   - Current: Subscription filter in resolver code
   - Risk: If resolver code is accidentally removed, anyone can subscribe to anyone's events
   - Mitigation: Add test that asserts subscription filter exists
   - Better: Use AppSync's built-in @subscribe authorization (declarative, harder to bypass)

2. **AppSync Resolver Injection**
   - Current: Resolvers use `ctx.args.targetUserId` without sanitizing
   - Risk: If resolver is misconfigured, could inject DynamoDB queries
   - Mitigation: AppSync VTL is not vulnerable to injection (type-safe), but be careful with string building
   - Example vulnerability: Avoid building GraphQL query strings dynamically

3. **SQS Message Tampering**
   - Current: SQS messages sent within AWS (AppSync → SQS → Lambda)
   - Risk: If SQS URL is publicly exposed, attacker could send fake notifications
   - Mitigation: SQS URL is internal (not internet-facing); good
   - Better: Use SQS access policy to restrict to AppSync data source role

4. **Lambda Environment Variable Leakage**
   - Current: Lambda has `APPSYNC_ENDPOINT` in environment
   - Risk: If Lambda is compromised, attacker knows endpoint
   - Mitigation: Use AWS Secrets Manager for sensitive values
   - Current risk level: Low (endpoint is guessable anyway)

5. **DynamoDB Scan for Authorization**
   - Current: You don't do full-table scans for auth checks
   - Risk: Not applicable here, but worst practice
   - Good: Use queries with PK + conditions

6. **Cognito Credential Stuffing**
   - Risk: Attacker tries common passwords against Cognito
   - Mitigation: Enable Cognito account lockout, require strong passwords
   - Further: Add Cognito Risk Adaptation (detect unusual login patterns)

**Best practices you're already doing:**
- Least privilege IAM roles
- Storage-layer enforcement of auth
- Idempotent operations

---

## Common Interview Mistakes to Avoid

1. **Don't say "I just copied code from AI"**
   - Instead: "I used AI to bootstrap, then understood and modified each part"
   - Interviewers will ask deep questions to verify

2. **Don't claim you invented multi-tenant or OpenSearch integration**
   - Be honest: "This is single-tenant. Multi-tenant would require..."
   - Show you've thought about tradeoffs

3. **Don't forget about DynamoDB costs**
   - Interviewers care about cost
   - Your On-Demand model: you pay per request (good for low traffic)
   - At scale: Provisioned capacity is cheaper

4. **Don't forget about subscriptions challenges**
   - "Real-time is hard. If connection drops, user misses event. Mitigation: always query as fallback."

5. **Don't forget the business context**
   - "This is built for a social app with follow requests, notifications, real-time updates"
   - Show you understand why architecture decisions were made

