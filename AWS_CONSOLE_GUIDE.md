# AWS Console Navigation Guide: Complete Walkthrough

This guide shows you **exactly where to go** in the AWS Console to see each component of your Buzzer application running live.

---

## Prerequisites

1. AWS Account with your deployed Buzzer infrastructure
2. Correct AWS region (default: `ap-south-1` or check your Amplify config)
3. IAM user with permissions to read AppSync, DynamoDB, Lambda, Cognito, SQS, etc.

**How to check your region:**
```
AWS Console (top-right) → shows current region like "ap-south-1"
If wrong, click dropdown → select your region
```

---

## 1. COGNITO: User Authentication

### Goal
See all users who've signed up, verify email confirmations, understand the auth flow.

### Navigate
1. AWS Console → Search bar type `"Cognito"` → press Enter
2. Left panel: **"User Pools"** (click)
3. You'll see a list of pools. Click: **`buzzertaskcc0bb83c-<env>`**
   - Example: `buzzertaskcc0bb83c-dev`

### What You See: User Pool Dashboard
```
Pool Overview
├── General Settings
├── Users and groups
├── App clients
├── Triggers
├── Domains
├── etc.
```

### View All Users
1. Left panel: **"Users and groups"**
2. Table appears with columns:
   - Username
   - Status (UNCONFIRMED, CONFIRMED, etc.)
   - Email verified
   - MFA enabled
   - Created date

3. Click any username → see user details:
   - Attributes: email, preferred_username, name, sub (Cognito ID)
   - Sign-up method
   - MFA devices
   - Group memberships

### View Post-Confirmation Trigger

**If you don't see "Triggers" in the left panel:**

The left panel in Cognito has two sections:
- **Section 1 (top):** "General Settings", "Users and groups", etc.
- **Section 2 (lower):** "Triggers" is here but might be collapsed

**To find Triggers:**

**Option A: Manual Navigation**
1. You should be in your User Pool (e.g., `buzzertaskcc0bb83c-dev`)
2. Left panel has multiple sections - look for the dividing line
3. Below "App clients" and "Resource servers", there's another section
4. In that lower section, find: **"Triggers"** 
5. Click **"Triggers"**

**Option B: Direct URL (Fastest)**
1. Copy your User Pool ID/Name from the current page
2. In the URL bar, change the path from `/users` to `/triggers`
   - Example: Change from `...buzzertaskcc0bb83c-dev/users` to `...buzzertaskcc0bb83c-dev/triggers`
3. Press Enter

**Option C: Search Alternative**
1. Instead of clicking around, go to Lambda service directly:
2. AWS Console → Search **"Lambda"** 
3. Search for: **`postConfirmationTrigger`**
4. Click the function → **"Triggers"** tab at the top
5. Scroll down to see it's triggered by Cognito

**Once you find Triggers:**
1. Look for: **"Post Confirmation"** event
2. Shows:
   - Lambda function name: `postConfirmationTrigger-<env>`
   - Region where Lambda lives

**Why check this:** If new users aren't getting DynamoDB profiles created, this trigger might be disabled.

### Create a Test User (for manual testing)
1. Left panel: **"Users and groups"**
2. Click button: **"Create user"**
3. Fill in:
   - Username: `testuser1`
   - Temporary password: `TempPassword123!`
   - Email: `test@example.com`
4. **Attributes** tab → set:
   - email verified: YES
   - preferred_username: `testuser1`
5. Click **"Create"**

**Important:** This creates a user but doesn't run the post-confirmation trigger (requires email verification). To test the trigger:
1. Go back to **Users and groups**
2. Select the user → **"Confirm user"** button
3. Lambda trigger fires automatically

### Check Cognito Logs
1. Left panel: **"Activity"** (if available)
2. Shows: Recent signup/login/error events
3. CloudWatch integration: Left panel → **"App client settings"** → enable **"Enable token revocation"**, etc.

---

## 2. DYNAMODB: Database Tables

### Goal
Browse users, follows, and notifications tables. See the actual data structure.

### Navigate to All Tables
1. AWS Console → Search `"DynamoDB"` → Enter
2. Left panel: **"Tables"**
3. You'll see 3 tables:
   - `BuzzerUsers-<env>` (user profiles)
   - `BuzzerFollows-<env>` (follow relationships)
   - `BuzzerNotifications-<env>` (notifications)

### Explore BuzzerUsers Table

**Step 1: Select the table**
1. Click: `BuzzerUsers-dev` (or your env)
2. Tabs appear:
   - **Overview** (capacity, billing)
   - **Items** (browse records)
   - **Indexes** (GSI config)
   - **Metrics** (CloudWatch)

**Step 2: Browse users (Items tab)**
1. Click: **"Items"** tab
2. You see a table with columns:
   - `id` (Cognito sub)
   - `email`
   - `username`
   - `displayName`
   - `createdAt`
   - `avatarUrl`

3. Click any row → see full record details:
   ```json
   {
     "id": "550e8400-e29b-41d4-a716-446655440000",
     "email": "alice@example.com",
     "username": "alice",
     "displayName": "Alice Smith",
     "createdAt": "2024-04-23T10:00:00Z"
   }
   ```

**Step 3: Query specific user**
1. Click: **"Items"** tab
2. Top bar: **"Scan"** dropdown (click) → Select **"Query"**
3. Specify partition key:
   - Where it says `id =`, type a user's ID
   - Example: `550e8400-e29b-41d4-a716-446655440000`
4. Click: **"Run"**
5. Result shows that specific user

**What is Scan vs Query?**
- **Scan:** Reads entire table (inefficient, slow for large tables)
- **Query:** Uses partition key (efficient, fast)

### Explore BuzzerFollows Table

**Step 1: Select the table**
1. Click: `BuzzerFollows-dev`
2. Tabs: Overview, Items, Indexes

**Step 2: Browse all follows**
1. Click: **"Items"**
2. Table shows:
   - `requesterId` (who sent request)
   - `targetId` (who received request)
   - `status` (PENDING or ACCEPTED)
   - `createdAt`
   - `updatedAt`

**Example data:**
```
requesterId: alice-sub       | targetId: bob-sub          | status: ACCEPTED
requesterId: charlie-sub     | targetId: bob-sub          | status: PENDING
requesterId: alice-sub       | targetId: charlie-sub      | status: ACCEPTED
```

**Step 3: Query followers of a specific user (using GSI)**
1. Click: **"Items"**
2. Top bar: **"Scan"** dropdown → **"Query"**
3. Partition key section:
   - Change from `requesterId` to `byTarget` (the GSI name)
4. Specify: `targetId = <user-id>`
   - Example: `bob-sub`
5. Add filter: `status = ACCEPTED` (optional)
6. Click: **"Run"**
7. Result: All users who follow Bob

**What is GSI (Global Secondary Index)?**
- Default primary key: `requesterId + targetId` (great for "who do I follow?")
- GSI `byTarget`: `targetId + requesterId` (great for "who follows me?")
- Without GSI, you'd have to scan entire table (slow)
- With GSI, query is fast regardless of table size

### Explore BuzzerNotifications Table

**Step 1: Select table**
1. Click: `BuzzerNotifications-dev`

**Step 2: Browse notifications**
1. Click: **"Items"**
2. Table shows:
   - `recipientId` (who gets the notification)
   - `createdAt` (when it was created)
   - `id` (UUID, unique identifier)
   - `senderId` (who triggered it)
   - `type` (FOLLOW_REQUEST_RECEIVED, FOLLOW_REQUEST_ACCEPTED)
   - `read` (boolean)

**Example data:**
```
recipientId: bob-sub      | createdAt: 2024-04-23T10:05:00Z | id: uuid-1 | type: FOLLOW_REQUEST_RECEIVED
recipientId: alice-sub    | createdAt: 2024-04-23T10:10:00Z | id: uuid-2 | type: FOLLOW_REQUEST_ACCEPTED
```

**Step 3: Query Bob's notifications**
1. Click: **"Items"**
2. Partition key: `recipientId = bob-sub`
3. Click: **"Run"**
4. Result: All notifications for Bob, sorted by `createdAt` descending (latest first)

### View Table Metrics

**For any table:**
1. Click: **"Metrics"** tab
2. Shows graphs:
   - **ConsumedReadCapacityUnits** (how many reads)
   - **ConsumedWriteCapacityUnits** (how many writes)
   - **UserErrors** (client errors)
   - **SystemErrors** (AWS errors)
   - **SuccessfulRequestLatency** (milliseconds per request)

**Reading metrics:**
- Spike in ConsumedReadCapacityUnits: Your app was querying a lot
- Spike in UserErrors: Your app sent malformed requests
- Spike in SystemErrors: DynamoDB had a problem (rare)
- High SuccessfulRequestLatency: Your app is slow (check CloudWatch logs)

### Manual Insert (for testing)

**To add a test notification to Bob's table:**
1. Click: **"Items"**
2. Button: **"Create item"** (top right)
3. Fill in:
   ```json
   {
     "recipientId": { "S": "bob-sub-id" },
     "createdAt": { "S": "2024-04-23T11:00:00Z" },
     "id": { "S": "test-uuid-123" },
     "senderId": { "S": "alice-sub-id" },
     "type": { "S": "FOLLOW_REQUEST_RECEIVED" },
     "read": { "BOOL": false }
   }
   ```
4. Click: **"Create item"**
5. Refresh Items tab → see your new notification

---

## 3. APPSYNC: GraphQL API

### Goal
Understand API structure, test queries/mutations, see resolver configuration.

### Navigate
1. AWS Console → Search `"AppSync"` → Enter
2. Left panel: **"APIs"**
3. Click: `buzzertask`

### View GraphQL Schema
1. Left panel: **"Schema"**
2. Shows your entire GraphQL schema:
   ```graphql
   type Query {
     getMyProfile: User @aws_cognito_user_pools
     getMyFollowers(limit: Int, nextToken: String): FollowConnection
     ...
   }
   
   type Mutation {
     requestFollow(targetUserId: ID!): Follow @aws_cognito_user_pools
     acceptFollowRequest(requesterId: ID!): Follow @aws_cognito_user_pools
     createNotificationInternal(input: CreateNotificationInput!): Notification @aws_iam
   }
   ```

3. Click any type name (e.g., `User`) → see all fields
4. Hover over `@aws_cognito_user_pools` → explains auth requirement

### Test Queries in GraphQL Explorer

**Step 1: Get authorization**
1. Left panel: **"Queries"** (this opens GraphQL Explorer)
2. Top right corner: Look for **"Auth type"** dropdown
3. Select: **"User Pool"** (default: USER_POOL)
4. A login prompt appears → Sign in with a test user
   - Email: `alice@example.com`
   - Password: `<password>`
5. On successful login, a JWT token is stored in the browser

**Step 2: Run a query**
1. Left panel: **"Queries"**
2. In the **Editor** section (left), type:
   ```graphql
   query {
     getMyProfile {
       id
       username
       email
       displayName
     }
   }
   ```
3. Click: **"Execute query"** (play button) or press Ctrl+Enter
4. Right panel shows result:
   ```json
   {
     "data": {
       "getMyProfile": {
         "id": "550e8400-e29b-41d4-a716-446655440000",
         "username": "alice",
         "email": "alice@example.com",
         "displayName": "Alice Smith"
       }
     }
   }
   ```

**Step 3: Run a mutation**
1. In Editor, type:
   ```graphql
   mutation {
     requestFollow(targetUserId: "bob-sub-id") {
       requesterId
       targetId
       status
       createdAt
     }
   }
   ```
2. Click: **"Execute"**
3. Result:
   ```json
   {
     "data": {
       "requestFollow": {
         "requesterId": "alice-sub-id",
         "targetId": "bob-sub-id",
         "status": "PENDING",
         "createdAt": "2024-04-23T11:05:00Z"
       }
     }
   }
   ```

**Step 4: Handle errors**
1. Try running an invalid query (typo in field name):
   ```graphql
   query {
     getMyProfile {
       invalidField  // ← This field doesn't exist
     }
   }
   ```
2. Right panel shows error:
   ```json
   {
     "errors": [
       {
         "message": "Cannot query field \"invalidField\" on type \"User\".",
         "locations": [{"line": 3, "column": 7}]
       }
     ]
   }
   ```

### View Resolvers

**Step 1: Navigate to resolvers**
1. Left panel: **"Resolvers"**
2. Table appears with columns:
   - Type (Query, Mutation, Subscription, etc.)
   - Field (e.g., `getMyFollowers`)
   - Data source (e.g., `BuzzerFollows` table)
   - Resolver (Pipeline: step 1, step 2, etc.)

**Step 2: Click on a resolver**
1. Click: `Query > getMyFollowers`
2. Details panel opens showing:
   - **Request mapping template** (JavaScript code)
   - **Response mapping template** (JavaScript code)
   - **Data source** (which DynamoDB table)

3. Example request template:
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
   ```

4. Example response template:
   ```javascript
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

**What to look for:**
- `ctx.identity.sub` → Extract caller's ID (authorization)
- `ctx.args` → Arguments passed by client (e.g., targetUserId)
- `util.error(...)` → Error handling
- DynamoDB condition expressions → Authorization at storage layer

### View Data Sources

**Step 1: Left panel → "Data sources"**
2. Lists all connected backends:
   - `BuzzerUsers` → DynamoDB table
   - `BuzzerFollows` → DynamoDB table
   - `BuzzerNotifications` → DynamoDB table
   - `postConfirmationTrigger` → Lambda function
   - `notificationProcessor` → Lambda function
   - `SQS` → SQS queue (for sending messages)

3. Click any data source → see:
   - Name
   - Type (DynamoDB, Lambda, HTTP, etc.)
   - IAM role used to access it
   - Connection details

### View Logs

**Step 1: Left panel → Scroll down → "Monitoring"**
2. Shows CloudWatch metrics:
   - **Requests** (total count)
   - **Errors** (mutation/query failures)
   - **Latency** (milliseconds per request)

3. Click graph → opens CloudWatch in new tab for detailed analysis

**Step 2: View resolver logs**
1. Left panel: **"Logs"** (if available) or go to CloudWatch separately
2. Look for log group: `/aws/appsync/<api-id>`
3. See all AppSync operations with timestamps, resolver names, duration

---

## 4. LAMBDA: Serverless Functions

### Goal
Check function configuration, view logs, see execution metrics.

### Navigate
1. AWS Console → Search `"Lambda"` → Enter
2. Left panel: **"Functions"**
3. You see 2 functions:
   - `postConfirmationTrigger` (handles Cognito signup)
   - `notificationProcessor` (handles SQS messages)

### Examine postConfirmationTrigger

**Step 1: Click function name**
1. Opens function dashboard

**Step 2: View configuration**
1. Tab: **"Configuration"**
2. See:
   - **General configuration:**
     - Runtime: Node.js 20.x
     - Timeout: 60 seconds (default)
     - Memory: 128 MB (minimum)
   - **Environment variables:**
     - `USERS_TABLE`: `BuzzerUsers-dev`
     - `AWS_REGION`: `ap-south-1`
   - **Execution role:**
     - IAM role that grants permissions to access DynamoDB, logs, etc.

3. Execution role: Click the role name → view inline policies
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:PutItem",
           "dynamodb:GetItem"
         ],
         "Resource": "arn:aws:dynamodb:*:*:table/BuzzerUsers-*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "logs:CreateLogGroup",
           "logs:CreateLogStream",
           "logs:PutLogEvents"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

**Step 3: View code**
1. Tab: **"Code"**
2. Shows the source code of your Lambda function (read-only in console)
3. To edit: You'd use a code editor (VS Code) and redeploy via Amplify CLI

**Step 4: View execution logs**
1. Tab: **"Monitor"**
2. Graphs show:
   - **Duration** (milliseconds per execution)
   - **Invocations** (how many times it ran)
   - **Errors** (failures)
   - **Concurrent executions** (how many running simultaneously)

3. Click **"View CloudWatch Logs"**
4. Redirects to CloudWatch → see all execution logs:
   ```
   2024-04-23 10:00:15 [postConfirmationTrigger] Created user record for sub=550e8400-e29b-41d4-a716-446655440000
   2024-04-23 10:00:20 [postConfirmationTrigger] Created user record for sub=8a6f7c52-1b59-4e85-8c7f-3f2a9d8b5c1a
   2024-04-23 10:05:12 [postConfirmationTrigger] Failed to create user: DynamoDB Error
   ```

### Examine notificationProcessor

**Step 1: Click function**

**Step 2: View configuration**
1. **Environment variables:**
   - `APPSYNC_ENDPOINT`: GraphQL API endpoint
   - `AWS_REGION`: Your region

**Step 3: View SQS trigger**
1. Tab: **"Configuration"**
2. Scroll: **"Triggers"**
3. Shows:
   - Trigger source: **SQS** queue
   - Queue name: `BuzzerNotificationQueue-<env>`
   - Batch size: 10 (processes up to 10 messages per invocation)
   - State: ENABLED

**Step 4: Test the function manually**
1. Tab: **"Test"**
2. Event template: Select **"SQS"**
3. Modify the event (example):
   ```json
   {
     "Records": [
       {
         "messageId": "test-message-1",
         "body": "{\"recipientId\": \"bob-sub\", \"senderId\": \"alice-sub\", \"type\": \"FOLLOW_REQUEST_RECEIVED\", \"timestamp\": \"2024-04-23T11:00:00Z\"}",
         "receiptHandle": "test-handle"
       }
     ]
   }
   ```
4. Click: **"Test"**
5. Result shows:
   - Successful execution time
   - Logs output
   - Any errors

---

## 5. SQS: Message Queue

### Goal
See queued messages, understand retry behavior, check DLQ.

### Navigate
1. AWS Console → Search `"SQS"` → Enter
2. Left panel: **"Queues"**
3. Click: `BuzzerNotificationQueue-<env>`

### View Queue Metrics

**Dashboard shows:**
- **Messages Available** (waiting to be processed)
- **Messages in Flight** (being processed by Lambda)
- **Messages Sent** (total ever sent)
- **Receive Count** (avg retries)
- **Age of Oldest Message** (seconds, indicates backlog)

**Example:**
```
Messages Available: 5
Messages in Flight: 2
Messages Sent (last hour): 847
Age of Oldest Message: 23 seconds
```

This means:
- 5 messages waiting
- 2 currently being processed by Lambda
- Lambda is keeping up (old message is only 23s old)

### Send a Test Message

**Step 1: Click button "Send message"**

**Step 2: Fill in**
- Message body:
  ```json
  {
    "recipientId": "bob-sub-id",
    "senderId": "alice-sub-id",
    "type": "FOLLOW_REQUEST_RECEIVED",
    "timestamp": "2024-04-23T11:05:00Z"
  }
  ```

**Step 3: Click "Send message"**

**Step 4: Lambda automatically picks it up**
- Within seconds, Lambda invocation appears in CloudWatch logs
- Message is processed and creates a notification in DynamoDB

### Monitor DLQ (Dead Letter Queue)

**Step 1: Click queue**

**Step 2: Left side → Find "Dead-letter queue"** (if configured)

**Step 3: Click DLQ name**

**What's in DLQ:**
- Messages that failed 3 times (default retry count)
- Usually indicates Lambda is broken or AppSync is unreachable
- Example: SQS publishes message → Lambda tries 3 times → fails → moves to DLQ

**Step 4: Set up alarm**
- Right panel: **"Alarms"**
- Create alarm: If DLQ depth > 0 → alert team

---

## 6. CLOUDFORMATION: Infrastructure as Code

### Goal
See all resources created by your Amplify project, understand how they're connected.

### Navigate
1. AWS Console → Search `"CloudFormation"` → Enter
2. Left panel: **"Stacks"**
3. Find stack: `amplify-buzzertask-dev` (or your env)

### View Stack Resources

**Step 1: Click stack name**

**Step 2: Tab: "Resources"**

**Table shows all AWS resources:**
```
Logical ID                | Physical ID                           | Type
────────────────────────────────────────────────────────────
BuzzerUsersTable          | BuzzerUsers-dev                      | AWS::DynamoDB::Table
BuzzerFollowsTable        | BuzzerFollows-dev                    | AWS::DynamoDB::Table
BuzzerNotificationsTable  | BuzzerNotifications-dev              | AWS::DynamoDB::Table
BuzzerNotificationQueue   | BuzzerNotificationQueue-dev          | AWS::SQS::Queue
PostConfirmationTrigger   | postConfirmationTrigger-dev          | AWS::Lambda::Function
NotificationProcessor     | notificationProcessor-dev            | AWS::Lambda::Function
CognitoUserPool           | ap-south-1_xxxxxxxxxx               | AWS::Cognito::UserPool
AppSyncAPI                | buzzertask                           | AWS::AppSync::GraphQLApi
AppSyncDatasource         | BuzzerUsers-datasource               | AWS::AppSync::DataSource
...
```

Each row = 1 AWS resource

### View Stack Events

**Step 1: Tab: "Events"**

**Shows deployment history:**
```
Time               | Resource         | Status          | Reason
──────────────────────────────────────────────────────────────
2024-04-23 11:00  | amplify-...      | CREATE_IN_PROGRESS | Stack creation started
2024-04-23 11:01  | BuzzerUsersTable | CREATE_IN_PROGRESS | Resource creation started
2024-04-23 11:02  | BuzzerUsersTable | CREATE_COMPLETE    | ✓ Created
2024-04-23 11:03  | BuzzerFollows... | CREATE_IN_PROGRESS | ...
...
```

If deployment failed, the error appears here.

### View Stack Outputs

**Step 1: Tab: "Outputs"**

**Shows important values (usually none for Amplify stacks)**

For custom CloudFormation, this would show:
- API endpoint URL
- Table names
- Lambda function ARNs
- etc.

### View Stack Template (Infrastructure Code)

**Step 1: Tab: "Template"**

**Shows the CloudFormation JSON/YAML that defined everything**

Example snippet:
```json
{
  "Resources": {
    "BuzzerUsersTable": {
      "Type": "AWS::DynamoDB::Table",
      "Properties": {
        "TableName": "BuzzerUsers-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
          { "AttributeName": "id", "AttributeType": "S" }
        ],
        "KeySchema": [
          { "AttributeName": "id", "KeyType": "HASH" }
        ]
      }
    }
  }
}
```

---

## 7. CLOUDWATCH: Logs & Monitoring

### Goal
Debug issues by viewing detailed logs from all services.

### Navigate
1. AWS Console → Search `"CloudWatch"` → Enter
2. Left panel: **"Logs"** → **"Log groups"**

### Important Log Groups

| Log Group | What It Captures |
|-----------|-----------------|
| `/aws/lambda/postConfirmationTrigger` | Cognito signup flow |
| `/aws/lambda/notificationProcessor` | SQS → Notification creation |
| `/aws/appsync/<api-id>` | AppSync resolver execution |
| `/aws/cognito/<pool-id>` | Cognito user pool events |
| `/aws/dynamodb/...` | DynamoDB slow queries (if enabled) |

### View Logs for postConfirmationTrigger

**Step 1: Click log group**
1. `/aws/lambda/postConfirmationTrigger`

**Step 2: Click log stream**
- Shows streams for each Lambda invocation (or batches)
- Newest first

**Step 3: View log events**
- Each log entry shows:
  - Timestamp
  - Log message (your console.log statements)
  - AWS metadata

**Example:**
```
2024-04-23T10:00:15.123Z  550e8400-e29b-41d4-a716-446655440000  [postConfirmationTrigger] Created user record for sub=550e8400-e29b-41d4-a716-446655440000
2024-04-23T10:00:16.456Z  550e8400-e29b-41d4-a716-446655440000  START RequestId: 12345678-1234-1234-1234-123456789012 Version: $LATEST
2024-04-23T10:00:17.789Z  550e8400-e29b-41d4-a716-446655440000  END RequestId: 12345678-1234-1234-1234-123456789012
2024-04-23T10:00:18.012Z  550e8400-e29b-41d4-a716-446655440000  REPORT Duration: 2500.45ms Memory Used: 89MB
```

### Search Logs (CloudWatch Insights)

**Step 1: From log group, click: "Insights" (top bar)**

**Step 2: Run a query:**
```
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by @message
```

This finds all ERROR messages and counts them.

**Another useful query:**
```
fields @timestamp, @duration
| stats avg(@duration), max(@duration), pct(@duration, 95)
```

Shows average, max, and p95 execution time.

---

## 8. IAM: Permissions & Roles

### Goal
Understand which services have permission to do what.

### Navigate
1. AWS Console → Search `"IAM"` → Enter
2. Left panel: **"Roles"**

### Find Lambda Execution Role

**Step 1: Search for "postConfirmationTrigger" role**

**Step 2: Click role name**

**Step 3: Tab: "Permissions"**

**Shows inline policies:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/BuzzerUsers-*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

**Reading this:**
- Lambda can call DynamoDB: PutItem (write), GetItem (read) on tables matching `BuzzerUsers-*`
- Lambda can write logs (required for CloudWatch)
- Lambda **cannot** call AppSync, SQS, etc. (not in this policy)

### Check AppSync Data Source Role

**Step 1: Go to AppSync API**

**Step 2: Left panel: **"Data sources"**

**Step 3: Click a data source (e.g., "BuzzerFollows")**

**Step 4: Shows:**
- Data source name
- Resource (DynamoDB table ARN)
- IAM role used to access it

---

## Debugging Workflow: "My mutation failed!"

### Step 1: Check CloudWatch Logs

1. AWS Console → CloudWatch → Log groups
2. Look for:
   - `/aws/appsync/<api-id>` → AppSync resolver error
   - `/aws/lambda/*` → Lambda error
   - `/aws/dynamodb` → DynamoDB throttling

### Step 2: Check AppSync Query Explorer

1. AWS Console → AppSync → "Queries"
2. Reproduce the failing mutation
3. Right panel shows error details:
   ```json
   {
     "errors": [
       {
         "message": "No pending follow request found",
         "errorType": "NotFoundOrUnauthorized",
         "path": ["acceptFollowRequest"]
       }
     ]
   }
   ```

### Step 3: Check DynamoDB Data

1. AWS Console → DynamoDB → Tables
2. Click the table involved
3. Query the item to see current state
4. Verify it matches what your resolver expects

### Step 4: Check IAM Permissions

1. AWS Console → IAM → Roles
2. Find the role used (Lambda, AppSync data source)
3. Check permissions match what you're trying to do

### Step 5: Check SQS (if async)

1. AWS Console → SQS → Select queue
2. Check "Messages Available" and "Messages in Flight"
3. If messages pile up → Lambda is too slow or broken
4. Check CloudWatch logs for Lambda errors

---

## Quick Reference: Common Tasks

### "How many users have signed up?"
1. DynamoDB → BuzzerUsers table → Items tab
2. Scan returns item count (shown in results)

### "Did Alice follow Bob?"
1. DynamoDB → BuzzerFollows table → Items tab
2. Query where requesterId=alice-sub AND targetId=bob-sub

### "Why didn't Bob get a notification?"
1. Check DynamoDB → BuzzerNotifications → Query recipientId=bob-sub
2. If empty, check CloudWatch → notificationProcessor logs
3. If Lambda errored, see error message

### "Is the API working?"
1. AppSync → Queries → Run getMyProfile
2. If error, check CloudWatch → /aws/appsync logs

### "How many follows are pending?"
1. DynamoDB → BuzzerFollows → Items tab
2. Scan with filter: status=PENDING
3. Count results

### "Check subscription connections"
1. Currently: No built-in dashboard (would need CloudWatch custom metric)
2. Workaround: Check AppSync metrics → Subscriptions Active

---

## Monitoring Checklist

**Daily:**
- [ ] CloudWatch Alarms: Any triggering?
- [ ] SQS DLQ: Any messages?
- [ ] Lambda error rate: > 1%?

**Weekly:**
- [ ] DynamoDB throttling events?
- [ ] AppSync latency increasing?
- [ ] Any Cognito lockouts?

**Before deploying changes:**
- [ ] Run test script: `node test/run-demo.mjs`
- [ ] Check CloudFormation stack events (no failures)
- [ ] Verify Lambda environment variables are set correctly

