/**
 * Buzzer Demo Test Script
 * ========================
 * Tests the full social graph flow:
 *   1. Sign up User A + User B
 *   2. Get auth tokens for both
 *   3. User A sends follow request to User B
 *   4. User B accepts follow request
 *   5. Query getMyFollowers as User B → should include A
 *   6. Query getMyFollowings as User A → should include B
 *
 * Usage:
 *   node test/run-demo.mjs
 *
 * Required env vars (copy from .env.test after amplify push):
 *   USER_POOL_ID, CLIENT_ID, APPSYNC_ENDPOINT, AWS_REGION
 */

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadAmplifyUiConfig() {
  const cfgPath = path.resolve(__dirname, "../ui/amplifyconfiguration.json");
  const raw = await readFile(cfgPath, "utf8");
  return JSON.parse(raw);
}

async function resolveRuntimeConfig() {
  let uiConfig = null;
  try {
    uiConfig = await loadAmplifyUiConfig();
  } catch {
    // Allow env-only configuration when UI artifacts are not present.
  }

  const USER_POOL_ID = process.env.USER_POOL_ID || uiConfig?.aws_user_pools_id;
  const CLIENT_ID = process.env.CLIENT_ID || uiConfig?.aws_user_pools_web_client_id;
  const APPSYNC_ENDPOINT =
    process.env.APPSYNC_ENDPOINT || uiConfig?.aws_appsync_graphqlEndpoint;
  const REGION =
    process.env.AWS_REGION ||
    uiConfig?.aws_project_region ||
    uiConfig?.aws_cognito_region ||
    uiConfig?.aws_appsync_region;

  const missing = [];
  if (!USER_POOL_ID) missing.push("USER_POOL_ID / aws_user_pools_id");
  if (!CLIENT_ID) missing.push("CLIENT_ID / aws_user_pools_web_client_id");
  if (!APPSYNC_ENDPOINT)
    missing.push("APPSYNC_ENDPOINT / aws_appsync_graphqlEndpoint");
  if (!REGION) missing.push("AWS_REGION / aws_project_region");

  if (missing.length) {
    throw new Error(
      [
        "Missing runtime config for demo test:",
        ...missing.map((m) => `  - ${m}`),
        "",
        "Provide env vars or ensure ui/amplifyconfiguration.json exists after amplify push.",
      ].join("\n")
    );
  }

  return { USER_POOL_ID, CLIENT_ID, APPSYNC_ENDPOINT, REGION };
}

const { USER_POOL_ID, CLIENT_ID, APPSYNC_ENDPOINT, REGION } = await resolveRuntimeConfig();

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`\n[${step}] ${msg}`);
}

async function signUp(email, password, username) {
  try {
    await cognitoClient.send(
      new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "preferred_username", Value: username },
        ],
      })
    );
    log("SignUp", `Created user: ${email}`);
  } catch (err) {
    if (err.name === "UsernameExistsException") {
      log("SignUp", `User ${email} already exists, continuing...`);
    } else {
      throw err;
    }
  }
}

async function adminConfirm(username) {
  // Auto-confirm without email code — works in dev with AdminConfirmSignUp
  try {
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      })
    );
    log("Confirm", `Admin-confirmed user: ${username}`);
  } catch (err) {
    if (err.name === "NotAuthorizedException" && err.message.includes("CONFIRMED")) {
      log("Confirm", `User ${username} already confirmed, skipping...`);
    } else {
      throw err;
    }
  }
}

async function getToken(email, password) {
  const res = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  );
  const token = res.AuthenticationResult.IdToken;
  const sub   = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).sub;
  log("Auth", `Got token for ${email} (sub: ${sub})`);
  return { token, sub };
}

async function gql(token, query, variables = {}) {
  const res = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ── GraphQL operations ───────────────────────────────────────────────────────

const REQUEST_FOLLOW = /* GraphQL */ `
  mutation RequestFollow($targetUserId: ID!) {
    requestFollow(targetUserId: $targetUserId) {
      requesterId targetId status createdAt
    }
  }
`;

const ACCEPT_FOLLOW = /* GraphQL */ `
  mutation AcceptFollow($requesterId: ID!) {
    acceptFollowRequest(requesterId: $requesterId) {
      requesterId targetId status updatedAt
    }
  }
`;

const GET_MY_FOLLOWERS = /* GraphQL */ `
  query GetMyFollowers {
    getMyFollowers {
      items { user { id username } followedAt status }
      nextToken
    }
  }
`;

const GET_MY_FOLLOWINGS = /* GraphQL */ `
  query GetMyFollowings {
    getMyFollowings {
      items { user { id username } followedAt status }
      nextToken
    }
  }
`;

// ── Main flow ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Buzzer Social Graph — Full Flow Demo Test");
  console.log("═══════════════════════════════════════════════════════");

  const userA = { email: "alice@demo.buzzer", password: "Demo@123!", username: "alice" };
  const userB = { email: "bob@demo.buzzer",   password: "Demo@123!", username: "bob"   };

  // Step 1: Register both users
  log("Step 1", "Registering User A (alice) and User B (bob)...");
  await signUp(userA.email, userA.password, userA.username);
  await signUp(userB.email, userB.password, userB.username);

  // Step 2: Admin-confirm (skip email verification for demo)
  log("Step 2", "Auto-confirming accounts...");
  await adminConfirm(userA.email);
  await adminConfirm(userB.email);

  // Step 3: Get tokens
  log("Step 3", "Getting auth tokens...");
  const tokenA = await getToken(userA.email, userA.password);
  const tokenB = await getToken(userB.email, userB.password);

  // Step 4: Alice follows Bob
  log("Step 4", `Alice (${tokenA.sub}) sends follow request to Bob (${tokenB.sub})...`);
  try {
    const followReq = await gql(tokenA.token, REQUEST_FOLLOW, { targetUserId: tokenB.sub });
    console.log("  Follow request created:", followReq.requestFollow);
    assert(followReq.requestFollow, "requestFollow returned null");
    assert(followReq.requestFollow.status === "PENDING", "requestFollow did not return PENDING");
  } catch(e) {
    if (e.message.includes("already exists")) {
      console.log("  Follow request already exists, skipping...");
    } else throw e;
  }

  // Step 5: Bob accepts Alice's request
  log("Step 5", "Bob accepts the follow request...");
  try {
    const accepted = await gql(tokenB.token, ACCEPT_FOLLOW, { requesterId: tokenA.sub });
    console.log("  Follow accepted:", accepted.acceptFollowRequest);
    assert(accepted.acceptFollowRequest, "acceptFollowRequest returned null");
    assert(accepted.acceptFollowRequest.status === "ACCEPTED", "acceptFollowRequest did not return ACCEPTED");
  } catch(e) {
    if (e.message.includes("No pending follow request found")) {
      console.log("  Follow request already accepted, skipping...");
    } else throw e;
  }

  // Step 6: Query Bob's followers — should see Alice
  log("Step 6", "Querying Bob's followers (should include Alice)...");
  const followers = await gql(tokenB.token, GET_MY_FOLLOWERS);
  console.log("  Bob's followers:", JSON.stringify(followers.getMyFollowers, null, 2));
  assert(followers.getMyFollowers, "getMyFollowers returned null");
  assert(
    followers.getMyFollowers.items.some((item) => item.user?.id === tokenA.sub),
    "Alice was not found in Bob's followers"
  );

  // Step 7: Query Alice's followings — should see Bob
  log("Step 7", "Querying Alice's followings (should include Bob)...");
  const followings = await gql(tokenA.token, GET_MY_FOLLOWINGS);
  console.log("  Alice's followings:", JSON.stringify(followings.getMyFollowings, null, 2));
  assert(followings.getMyFollowings, "getMyFollowings returned null");
  assert(
    followings.getMyFollowings.items.some((item) => item.user?.id === tokenB.sub),
    "Bob was not found in Alice's followings"
  );

  console.log("\n✅ All steps completed successfully!");
  console.log("   Check the AWS Console → SQS & DynamoDB to see the notification records.");
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err);
  process.exit(1);
});
