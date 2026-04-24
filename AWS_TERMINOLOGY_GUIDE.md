# AWS Services & Terminology Reference

A comprehensive guide to understanding AWS concepts and how they're used in Buzzer.

---

## AWS Services Used in Buzzer

### 1. AMPLIFY (Infrastructure Orchestration)

**What is it?**
- A framework that automates AWS infrastructure deployment
- Like a "smart deployment helper" that manages CloudFormation behind the scenes
- You define backend in code; Amplify creates AWS resources

**In Buzzer:**
```bash
amplify push
# Creates: Cognito User Pool, DynamoDB tables, AppSync API, Lambda functions, SQS queue, IAM roles
```

**Key commands:**
```bash
amplify init           # Initialize project
amplify push           # Deploy changes
amplify pull           # Fetch remote config
amplify delete         # Destroy all resources
amplify env add        # Create new environment (dev, staging, prod)
```

**Why use Amplify?**
- ✅ Handles complexity (you don't write CloudFormation JSON manually)
- ✅ Generates client SDKs (for web, mobile)
- ✅ Integrates AWS services automatically
- ✅ Manages authentication + authorization
- ❌ Less control than raw CloudFormation

**Amplify CLI vs Amplify Hosting:**
- Amplify CLI: Local tool to manage backend (what you use)
- Amplify Hosting: AWS service to host static websites + CI/CD

---

### 2. COGNITO (User Authentication & Identity)

**What is it?**
- Managed user directory service (like Firebase Auth, Auth0)
- Handles signup, login, password reset, email verification
- Provides JWT tokens for secure API access

**Key concepts:**

**User Pool:** Directory of users
- Users sign up → Cognito stores them securely
- Cognito hashes passwords (you never see them)
- Users confirm email → email verified
- Users get JWT tokens after login

**ID Token:** JWT with user claims
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",  // User ID
  "email": "alice@example.com",
  "email_verified": true,
  "preferred_username": "alice",
  "name": "Alice Smith",
  "iat": 1713873600,  // Issued at (Unix timestamp)
  "exp": 1713877200   // Expires (Unix timestamp)
}
```

**Access Token:** Different JWT with different claims
- Similar to ID token but used internally by Cognito
- AppSync can validate both

**Refresh Token:** Long-lived token
- Used to get new ID/Access tokens when expired
- Stored on client
- If leaked, attacker can generate new tokens (risky)

**Triggers:** Lambda functions that run at specific events
- Post-Confirmation: After user confirms email (your use case)
- Pre-Sign-Up: Before signup (can reject certain emails)
- Pre-Token-Generation: Before JWT token is issued (can add custom claims)
- Custom Message: To customize confirmation email content

**In Buzzer:**
```typescript
// amplify/backend/auth/buzzertaskcc0bb83c/overrides.ts
// Attaches postConfirmationTrigger Lambda to this Cognito event
```

**Key operations:**
```bash
# Signup (user does this via UI)
aws cognito-idp sign-up \
  --client-id <id> \
  --username alice \
  --password SecurePassword123 \
  --user-attributes Name=email Value=alice@example.com

# Confirm (user gets email code)
aws cognito-idp confirm-sign-up \
  --client-id <id> \
  --username alice \
  --confirmation-code 123456

# Login (get tokens)
aws cognito-idp initiate-auth \
  --client-id <id> \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=alice,PASSWORD=SecurePassword123
```

**Security notes:**
- Passwords transmitted over HTTPS only
- Cognito uses bcrypt internally
- Password minimum: uppercase + lowercase + number + special char
- Supports MFA (multi-factor authentication)
- Supports social login (Google, Facebook, etc.)

---

### 3. APPSYNC (GraphQL API)

**What is it?**
- AWS's managed GraphQL service
- Replaces REST APIs with graph query language
- Connects to data sources: DynamoDB, Lambda, RDS, HTTP, Elasticsearch, etc.
- Real-time subscriptions over WebSocket

**GraphQL basics:**

**Query:** Read data
```graphql
query {
  getMyProfile {
    id
    username
    email
  }
}
```

**Mutation:** Write data
```graphql
mutation {
  requestFollow(targetUserId: "123") {
    status
    createdAt
  }
}
```

**Subscription:** Real-time updates
```graphql
subscription {
  onFollowAccepted(requesterId: "me-id") {
    status
    targetId
  }
}
```

**In Buzzer:**
- Schema defined in schema.graphql
- Resolvers (JS files) translate GraphQL → DynamoDB
- Data sources register DynamoDB, Lambda, SQS, HTTP endpoints

**Why GraphQL over REST?**
- ✅ Client specifies exactly what fields it needs
- ✅ Single endpoint (no /users/, /posts/, /comments/ etc.)
- ✅ Real-time subscriptions built-in
- ✅ Strongly typed (schema enforced)
- ❌ More complex learning curve
- ❌ Requires different caching strategy

**Resolver:** Bridges GraphQL ↔ DynamoDB
```javascript
// Request: Transform GraphQL args → DynamoDB format
export function request(ctx) {
  return {
    operation: "Query",
    query: { expression: "id = :id" },
    expressionValues: { ":id": { S: ctx.args.id } }
  };
}

// Response: Transform DynamoDB result → GraphQL type
export function response(ctx) {
  return { id: ctx.result.id, name: ctx.result.name };
}
```

**Authorization in AppSync:**

| Decorator | What it means | Example |
|-----------|----------|---------|
| `@aws_cognito_user_pools` | Cognito JWT required | Most user-facing queries |
| `@aws_iam` | AWS IAM role required | `createNotificationInternal` |
| `@aws_api_key` | Static API key (dev only) | Not used in Buzzer |
| `@aws_auth` | Multiple auth providers | Rarely used |

**Pipeline resolvers:** Multiple resolvers run in sequence
- Step 1: Mutation.requestFollow.js (write DDB)
- Step 2: Mutation.requestFollow.SQS.js (publish event)
- Result: Both complete or entire mutation fails

---

### 4. DYNAMODB (NoSQL Database)

**What is it?**
- Fully managed NoSQL database
- No servers to manage (serverless)
- Scales automatically
- You pay per request (or provisioned capacity)

**Concepts:**

**Table:** Collection of items
- Similar to table in SQL, but more flexible schema
- No schema required (but good practice to define one)

**Item:** Single record
```json
{
  "id": { "S": "550e8400" },
  "username": { "S": "alice" },
  "email": { "S": "alice@example.com" },
  "createdAt": { "S": "2024-04-23T10:00:00Z" }
}
```

**Attribute:** Field in an item
- String (S), Number (N), Binary (B), Set (SS, NS, BS), Map (M), List (L), Boolean (BOOL), Null (NULL)

**Primary Key:** Uniquely identifies an item
- **Partition Key (PK / HASH):** Required, distributes data across partitions
- **Sort Key (SK / RANGE):** Optional, sorts within partition

**Example:**
```
Table: BuzzerFollows
- PK: requesterId (who sent request)
- SK: targetId (who received request)
- Together: (requesterId, targetId) is unique
- Allows efficient query: "Get all my followings" (PK=requesterId)
```

**Global Secondary Index (GSI):** Alternative PK + SK
```
Table (Main):
  PK: requesterId, SK: targetId
  Query: "Get my followings" → requesterId=alice

Index (byTarget):
  PK: targetId, SK: requesterId
  Query: "Get my followers" → targetId=alice
  
Both queries are fast!
Without GSI, "Get my followers" would scan entire table.
```

**Local Secondary Index (LSI):** Alternative SK with same PK
- Not used in Buzzer
- Different LSI limitations

**On-Demand Pricing:** Pay per request
- $1.25 per million reads
- $6.25 per million writes
- Good for unpredictable traffic
- Buzzer uses this (amplify default)

**Provisioned Capacity:** Pay upfront
- Specify: "10 read units, 5 write units per second"
- Cheaper at large scale
- More complex (need to estimate)

**DynamoDB Streams:** Change data capture
- Captures every insert/update/delete
- Feeds to Lambda for processing
- Used for: replication, search indexing, audit logs
- Bonus task uses this for OpenSearch sync

**Query vs Scan:**
- Query: Use PK (fast)
- Scan: Read entire table (slow)
- Always use Query when possible

**Conditions:** Prevent incorrect writes
```javascript
{
  operation: "PutItem",
  condition: {
    expression: "attribute_not_exists(id)"  // Only write if ID doesn't exist
  }
}
```

---

### 5. LAMBDA (Serverless Compute)

**What is it?**
- Write code, upload to AWS, AWS runs it when needed
- No servers to manage
- Scales automatically
- Pay per millisecond of execution

**How it works:**
```
1. Event triggers (Cognito, SQS, API call, timer, etc.)
2. AWS starts Lambda runtime
3. Lambda runs your code
4. Code completes
5. AWS charges you for milliseconds used
```

**In Buzzer:**
- postConfirmationTrigger: Triggered by Cognito after email confirmation
- notificationProcessor: Triggered by SQS when messages arrive

**Environment Variables:** Configuration passed to Lambda
```javascript
process.env.USERS_TABLE      // "BuzzerUsers-dev"
process.env.AWS_REGION       // "ap-south-1"
process.env.APPSYNC_ENDPOINT // GraphQL endpoint
```

**IAM Role:** Permissions Lambda has
- PutItem on DynamoDB tables
- CreateLogGroup/PutLogEvents on CloudWatch Logs
- Anything you explicitly grant

**Timeout:** How long Lambda can run (default 60s)
- If code runs > 60s, Lambda kills it
- Error: "Task timed out after 60.00 seconds"
- Configure in console or Amplify

**Memory:** RAM available (default 128 MB)
- CPU scales with memory
- Pay per MB-second
- 128 MB = 1 vCPU fraction, 1024 MB = full vCPU

**Cold Start:** Delay on first invocation
- "Cold start": Container spins up (100-500ms)
- "Warm start": Container reused (few ms)
- Add provisioned concurrency to avoid cold starts

**Runtimes:** Language support
- Node.js 20.x (Buzzer uses this)
- Python 3.11
- Java 21
- Go 1.x
- Ruby 3.2
- Custom runtimes

**Event:** Input to Lambda
```javascript
// SQS event
{
  "Records": [
    {
      "messageId": "...",
      "body": "{ ... }",
      "receiptHandle": "..."
    }
  ]
}

// Cognito trigger event
{
  "request": {
    "userAttributes": {
      "sub": "...",
      "email": "..."
    }
  },
  "response": {}
}
```

---

### 6. SQS (Simple Queue Service)

**What is it?**
- Managed message queue
- Producers send messages; consumers receive and process
- Messages persist until successfully processed
- At-least-once delivery guarantee

**Key concepts:**

**Queue:** Where messages wait
- FIFO: First-in-first-out (ordered)
- Standard: Best-effort ordering (default, Buzzer uses)

**Message:** Data being sent
```json
{
  "recipientId": "bob-sub",
  "senderId": "alice-sub",
  "type": "FOLLOW_REQUEST_RECEIVED",
  "timestamp": "2024-04-23T10:00:00Z"
}
```

**Producer:** Sends messages
- In Buzzer: AppSync resolver (Mutation.requestFollow.SQS.js)

**Consumer:** Processes messages
- In Buzzer: notificationProcessor Lambda

**Visibility Timeout:** Time consumer has to process message
- Default: 30 seconds
- If not deleted within 30s, message reappears for other consumers
- Consumer should delete message after successful processing

**Message Retention Period:** How long to keep unprocessed messages
- Default: 4 days
- If consumer never deletes, message auto-deleted after 4 days

**Retention Policy for Failed Messages:**
- After 3 redeliveries (default), message sent to DLQ (Dead Letter Queue)
- DLQ is separate queue for failed messages
- Ops team can monitor DLQ and investigate failures

**Why use SQS?**
- ✅ Decouples producer (AppSync) from consumer (Lambda)
- ✅ If consumer crashes, message waits and retries
- ✅ Scales: Thousands of messages queue up; Lambda processes as fast as possible
- ✅ Audit trail: All messages logged
- ❌ Not suitable for real-time guarantees (eventual consistency)

**In Buzzer:**
```
AppSync mutation
  ├─ Writes Follow to DynamoDB
  ├─ Publishes event to SQS (returns immediately)
  └─ Returns success to client

[Async]
Lambda polls SQS
  ├─ Sees message
  ├─ Calls AppSync to create Notification
  ├─ Deletes message from queue (success)
  └─ Or: throws error, message redelivered (retry)
```

---

### 7. CLOUDFORMATION (Infrastructure as Code)

**What is it?**
- JSON/YAML template that describes AWS resources
- "Infrastructure as Code"
- Amplify generates CloudFormation templates automatically

**Example template:**
```json
{
  "AWSTemplateFormatVersion": "2010-09-09",
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
    },
    "PostConfirmationTrigger": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "FunctionName": "postConfirmationTrigger-dev",
        "Runtime": "nodejs20.x",
        "Code": { "S3Bucket": "...", "S3Key": "..." },
        "Role": "arn:aws:iam::..."
      }
    }
  }
}
```

**Deployment:**
```
1. You define template
2. AWS CloudFormation validates
3. Creates/updates resources
4. Tracks dependencies (Table must exist before Lambda can access it)
5. Rollback if error occurs
```

**Stacks:** Named collection of resources
- Stack: "amplify-buzzertask-dev"
- Contains: 1 DynamoDB table, 1 Lambda, 1 AppSync API, etc.

**Why use CloudFormation?**
- ✅ Version control infrastructure (store template in Git)
- ✅ Reproducible: Same template = same infrastructure
- ✅ Handles dependencies automatically
- ✅ Easy to scale (add 3 dev stacks in 3 commands)
- ✅ Disaster recovery (destroy and recreate stack)

---

### 8. CLOUDWATCH (Logging & Monitoring)

**What is it?**
- AWS's native logging and monitoring service
- All AWS services log here automatically
- Search, filter, and analyze logs
- Create alarms based on metrics

**Log Groups:** Collections of logs
```
/aws/lambda/postConfirmationTrigger
  ├─ Log Stream 1 (Lambda execution 1)
  │   ├─ Log Event 1 (your console.log)
  │   ├─ Log Event 2 (Lambda metadata)
  │   └─ Log Event 3 (execution time)
  ├─ Log Stream 2 (Lambda execution 2)
  └─ ...
```

**Metrics:** Numerical measurements over time
- Lambda invocations (count)
- Lambda duration (milliseconds)
- Lambda errors (count)
- DynamoDB consumed read/write units
- SQS messages available
- AppSync latency

**Alarms:** Notifications when metrics exceed threshold
```
Condition: "SQS DLQ depth > 0 for 5 minutes"
Action: "Send email to ops@company.com"
```

**CloudWatch Insights:** Query logs with SQL-like syntax
```
fields @timestamp, @message, @duration
| filter @duration > 1000
| stats count() by @message
| sort count() desc
```

---

### 9. IAM (Identity & Access Management)

**What is it?**
- AWS's authorization system
- Who can do what on which resources

**Key concepts:**

**Principal:** "Who"
- IAM User
- IAM Role
- AWS Service (Lambda, Cognito, AppSync)

**Action:** "What"
- dynamodb:GetItem
- dynamodb:PutItem
- dynamodb:Query
- logs:CreateLogGroup
- s3:GetObject

**Resource:** "Which"
- arn:aws:dynamodb:ap-south-1:123456789:table/BuzzerUsers-dev
- arn:aws:lambda:ap-south-1:123456789:function:postConfirmationTrigger
- * (all resources)

**Policy:** Permission statement
```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
  "Resource": "arn:aws:dynamodb:*:*:table/BuzzerUsers-*"
}
```

**Role:** Container for policies
- Lambda has a role: "postConfirmationTriggerRole"
- Role has policies: "allow PutItem on BuzzerUsers table"
- Lambda assumes role and gets those permissions

**Trust relationship:** Who can use this role
```json
{
  "Effect": "Allow",
  "Principal": { "Service": "lambda.amazonaws.com" },
  "Action": "sts:AssumeRole"
}
```
Only Lambda service can assume this role.

**In Buzzer:**
```
postConfirmationTrigger Lambda Role
  ├─ Trust: Lambda service can assume this role
  └─ Policies:
      ├─ dynamodb:PutItem on BuzzerUsers table
      ├─ logs:CreateLogGroup/CreateLogStream/PutLogEvents
      └─ (implicitly has basic Lambda execution permissions)

notificationProcessor Lambda Role
  ├─ Trust: Lambda service can assume this role
  └─ Policies:
      ├─ appsync:GraphQL (call AppSync mutation)
      ├─ sqs:ReceiveMessage/DeleteMessage (consume queue)
      └─ logs:* (write logs)
```

**Least Privilege Principle:** Grant minimal permissions needed
- Good: `dynamodb:PutItem on table/BuzzerUsers-*`
- Bad: `dynamodb:* on *` (too broad)
- BadBadBad: AWS Account Root Access (dangerous)

---

## Common AWS Terminology

| Term | Meaning |
|------|---------|
| **ARN** | Amazon Resource Name. Unique identifier for any AWS resource. Example: `arn:aws:dynamodb:ap-south-1:123456789:table/BuzzerUsers-dev` |
| **Region** | Geographic area where resources live. Example: `ap-south-1` (Mumbai), `us-east-1` (N. Virginia) |
| **Availability Zone (AZ)** | Specific data center within a region. Example: `ap-south-1a`, `ap-south-1b`. Multi-AZ = high availability |
| **Service** | AWS product. Example: DynamoDB, Lambda, AppSync |
| **Resource** | Instance of a service. Example: DynamoDB table, Lambda function |
| **Stack** | CloudFormation collection. Example: "amplify-buzzertask-dev" contains all resources for this environment |
| **Environment** | Separate deployment. Dev, staging, prod each have their own stack |
| **IAM Role** | Set of permissions. Example: Lambda assumes role to get permissions |
| **Policy** | JSON document listing permissions. Attached to role or user |
| **API Endpoint** | URL to call a service. Example: `https://xxx.appsync-api.ap-south-1.amazonaws.com/graphql` |
| **Data Source** | Connection from AppSync to backend. Example: DynamoDB data source |
| **Resolver** | Code that transforms GraphQL ↔ DynamoDB operations |
| **Trigger** | Lambda function that runs on event. Example: Cognito post-confirmation trigger |
| **Event** | Input to Lambda. Example: SQS message, Cognito trigger |
| **Stream** | Real-time change notifications. Example: DynamoDB Streams |
| **Throughput** | Units per second. Example: "5 read units/sec" on DynamoDB |
| **Throttling** | Service rejects requests because limits exceeded. Example: DynamoDB throttled after exceeding provisioned capacity |
| **Cold Start** | Delay when Lambda runs after long idle period |
| **Warm Start** | Fast execution when Lambda container reused |
| **Lambda Layer** | Shared code/libraries across functions |
| **VPC** | Virtual Private Cloud. Network isolation. (Buzzer doesn't use) |
| **Security Group** | Firewall rules. (Buzzer doesn't use) |
| **Subnet** | Piece of VPC. (Buzzer doesn't use) |
| **DLQ** | Dead Letter Queue. Where failed messages go |
| **Visibility Timeout** | How long a consumer can process a message before it reappears |
| **Idempotency** | Operation produces same result if run multiple times. Example: UUID prevents duplicate notifications |
| **Condition Expression** | DynamoDB check before write. Example: "attribute_not_exists(id)" |
| **GSI** | Global Secondary Index. Alternative access pattern on DynamoDB table |
| **LSI** | Local Secondary Index. Alternative sort key with same partition key |
| **Partition Key** | Primary part of DynamoDB key. Distributes data |
| **Sort Key** | Secondary part of DynamoDB key. Sorts within partition |
| **Scan** | Read entire DynamoDB table (slow) |
| **Query** | Use DynamoDB primary key (fast) |

---

## AWS Cost Estimation

### DynamoDB (On-Demand)
- **Read:** $1.25 per million reads
- **Write:** $6.25 per million writes

**Example:**
- 1000 followers requests/day = 1000 writes @ $6.25/million = $0.006/day = $0.18/month
- 100 queries/day for followers @ $1.25/million = $0.0001/day = $0.003/month
- Total: ~$0.20/month

### Lambda
- **Compute:** $0.20 per 1 million invocations + $0.0000166667/GB-second

**Example (notificationProcessor Lambda):**
- 1000 notifications/day × 30 days = 30,000 invocations
- 30,000 × $0.20/million = $0.006/month
- Each Lambda runs ~500ms × 128MB = ~64MB-seconds
- 30,000 × 0.064 × $0.0000166667 = $0.032/month
- Total: ~$0.04/month

### Cognito
- **Users:** $0.015 per user/month (first 50k users free, then charged)

**Example:**
- 1000 users × $0.015 = $15/month (after free tier)

### AppSync
- **Queries/mutations:** $0.25 per million requests
- **Subscriptions:** $0.08 per million subscription-updates

**Example:**
- 10,000 requests/day = 300,000/month
- 300,000 × $0.25/million = $0.075/month

### SQS
- **Standard queue:** $0.40 per million messages

**Example:**
- 30,000 messages/month × $0.40/million = $0.012/month

### Total Monthly Cost for Buzzer
```
DynamoDB:       $0.20
Lambda:         $0.04
Cognito:        $15.00 (free first 50k users)
AppSync:        $0.08
SQS:            $0.01
CloudWatch:     ~$1.00 (logs storage)
────────────────────────
Total:          ~$16.33/month
```

At scale (1M users):
- Cognito: Much higher (100k+ users billed at $0.015 each)
- DynamoDB: Proportional increase
- Lambda: Proportional increase
- Still far cheaper than managing servers

---

## Security Best Practices (Used in Buzzer)

| Practice | How Buzzer Implements |
|----------|----------------------|
| **Never expose secrets** | No API keys in code. Lambda uses IAM role. |
| **Least privilege** | Lambda only has `dynamodb:PutItem`, not `dynamodb:*` |
| **Encrypt in transit** | HTTPS only. AppSync endpoint encrypted. |
| **Auth at every layer** | GraphQL decorator + resolver validation + DynamoDB condition |
| **No SQL injection** | DynamoDB uses parameter substitution (expressionValues) |
| **Idempotent operations** | UUIDs prevent duplicate notifications |
| **Audit trails** | CloudWatch logs all actions with timestamp, user, action |
| **Role-based access** | Different roles for Lambda, AppSync, users |
| **Scope authorization** | Subscriptions filter by caller (can't spy on others' events) |

---

## Troubleshooting Checklist

**"Things aren't working, what do I check?"**

1. **CloudWatch Logs**
   - `/aws/appsync/<api-id>` → resolver errors
   - `/aws/lambda/postConfirmationTrigger` → signup errors
   - `/aws/lambda/notificationProcessor` → async errors
   - `/aws/dynamodb/` → throttling

2. **DynamoDB**
   - Items table → is data there?
   - Indexes → correctly configured?
   - Metrics → any throttling?

3. **AppSync**
   - Schema → valid GraphQL?
   - Resolvers → any deleted?
   - Data sources → pointing to right tables?

4. **IAM**
   - Lambda role → has correct permissions?
   - AppSync role → can access DynamoDB?

5. **SQS**
   - Queue → messages available?
   - DLQ → any failed messages?
   - Lambda trigger → enabled?

6. **Cognito**
   - User pool → exists?
   - User → created and confirmed?
   - Trigger → attached and enabled?

---

## FAQ

**Q: Why doesn't AWS just provide one service instead of so many?**
A: Different services optimize for different use cases. DynamoDB is fast but inflexible. RDS is flexible but slower. SQS is simple but not real-time. You choose based on needs.

**Q: What if I need to change something deployed?**
A: Modify the code/config, deploy again. Amplify and CloudFormation handle updates. Can usually do without downtime.

**Q: How do I delete everything?**
A: `amplify delete` deletes all AWS resources. Or go to CloudFormation console and delete stack. Careful: this is destructive!

**Q: How do I debug Lambda in production?**
A: CloudWatch logs. Add console.log statements, redeploy, trigger action, check logs. Or use X-Ray for tracing.

**Q: Is my data secure?**
A: Yes. AWS uses industry-standard encryption, multi-AZ, regular backups. Better than self-hosted most of the time.

**Q: Can I migrate to another provider later?**
A: Yes, but it's work. DynamoDB data can be exported. Cognito data can be exported. AppSync queries need to be rewritten for different GraphQL service. Plan for portability from start.

---

## Next Steps

1. Read the guides in this folder:
   - INTERVIEW_PREP.md (Q&A)
   - AWS_CONSOLE_GUIDE.md (How to navigate)
   - HANDS_ON_EXERCISES.md (Practical learning)

2. Deploy and test the application

3. Explore each AWS service in the console

4. Understand each resolver fully

5. Practice explaining architecture to someone else

---

