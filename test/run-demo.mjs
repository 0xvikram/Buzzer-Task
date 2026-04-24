/**
 * Buzzer Demo Test Script
 *
 * Validates the main backend flow:
 * 1. Sign up User A + User B
 * 2. Confirm both users and get Cognito JWTs
 * 3. Verify post-confirmation persisted both profiles
 * 4. User A sends a follow request to User B
 * 5. Verify User B receives FOLLOW_REQUEST_RECEIVED notification
 * 6. User B accepts the follow request
 * 7. Verify follower/following queries
 * 8. Verify User A receives FOLLOW_REQUEST_ACCEPTED notification
 * 9. Verify IAM-only mutation cannot be called with a Cognito JWT
 */

import {
  AdminConfirmSignUpCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
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
  if (!APPSYNC_ENDPOINT) missing.push("APPSYNC_ENDPOINT / aws_appsync_graphqlEndpoint");
  if (!REGION) missing.push("AWS_REGION / aws_project_region");

  if (missing.length) {
    throw new Error(
      [
        "Missing runtime config for demo test:",
        ...missing.map((item) => `  - ${item}`),
        "",
        "Provide env vars or ensure ui/amplifyconfiguration.json exists after amplify push.",
      ].join("\n")
    );
  }

  return { USER_POOL_ID, CLIENT_ID, APPSYNC_ENDPOINT, REGION };
}

const { USER_POOL_ID, CLIENT_ID, APPSYNC_ENDPOINT, REGION } = await resolveRuntimeConfig();
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

function log(step, message) {
  console.log(`\n[${step}] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, fn, { attempts = 12, delayMs = 5000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        log("Wait", `${description} not ready yet (attempt ${attempt}/${attempts})`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error(`Timed out waiting for ${description}`);
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
  } catch (error) {
    if (error.name === "UsernameExistsException") {
      log("SignUp", `User ${email} already exists, continuing`);
      return;
    }
    throw error;
  }
}

async function adminConfirm(username) {
  try {
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      })
    );
    log("Confirm", `Admin-confirmed user: ${username}`);
  } catch (error) {
    if (error.name === "NotAuthorizedException" && error.message.includes("CONFIRMED")) {
      log("Confirm", `User ${username} already confirmed, skipping`);
      return;
    }
    throw error;
  }
}

async function getToken(email, password) {
  const response = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  );

  const token = response.AuthenticationResult.IdToken;
  const sub = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")).sub;
  log("Auth", `Got token for ${email} (sub: ${sub})`);
  return { token, sub };
}

async function gql(token, query, variables = {}) {
  const response = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors, null, 2)}`);
  }

  return json.data;
}

const REQUEST_FOLLOW = /* GraphQL */ `
  mutation RequestFollow($targetUserId: ID!) {
    requestFollow(targetUserId: $targetUserId) {
      requesterId
      targetId
      status
      createdAt
    }
  }
`;

const ACCEPT_FOLLOW = /* GraphQL */ `
  mutation AcceptFollow($requesterId: ID!) {
    acceptFollowRequest(requesterId: $requesterId) {
      requesterId
      targetId
      status
      updatedAt
    }
  }
`;

const GET_MY_PROFILE = /* GraphQL */ `
  query GetMyProfile {
    getMyProfile {
      id
      username
      email
      displayName
      createdAt
    }
  }
`;

const GET_MY_FOLLOWERS = /* GraphQL */ `
  query GetMyFollowers {
    getMyFollowers {
      items {
        user {
          id
          username
        }
        followedAt
        status
      }
      nextToken
    }
  }
`;

const GET_MY_FOLLOWINGS = /* GraphQL */ `
  query GetMyFollowings {
    getMyFollowings {
      items {
        user {
          id
          username
        }
        followedAt
        status
      }
      nextToken
    }
  }
`;

const GET_MY_NOTIFICATIONS = /* GraphQL */ `
  query GetMyNotifications {
    getMyNotifications {
      items {
        id
        recipientId
        senderId
        type
        read
        createdAt
      }
      nextToken
    }
  }
`;

const CREATE_NOTIFICATION_INTERNAL = /* GraphQL */ `
  mutation CreateNotificationInternal($input: CreateNotificationInput!) {
    createNotificationInternal(input: $input) {
      id
    }
  }
`;

async function main() {
  console.log("============================================================");
  console.log("  Buzzer Social Graph Full Flow Demo Test");
  console.log("============================================================");

  const runId = Date.now();
  const userA = {
    email: `alice+${runId}@demo.buzzer`,
    password: "Demo@123!",
    username: `alice${runId}`,
  };
  const userB = {
    email: `bob+${runId}@demo.buzzer`,
    password: "Demo@123!",
    username: `bob${runId}`,
  };

  log("Step 1", "Registering User A and User B");
  await signUp(userA.email, userA.password, userA.username);
  await signUp(userB.email, userB.password, userB.username);

  log("Step 2", "Confirming both users");
  await adminConfirm(userA.email);
  await adminConfirm(userB.email);

  log("Step 3", "Getting auth tokens");
  const tokenA = await getToken(userA.email, userA.password);
  const tokenB = await getToken(userB.email, userB.password);

  log("Step 4", "Verifying post-confirmation persisted both profiles");
  const profileA = await waitFor(
    "Alice profile persistence",
    async () => {
      const data = await gql(tokenA.token, GET_MY_PROFILE);
      assert(data.getMyProfile, "Alice profile not found");
      return data.getMyProfile;
    },
    { attempts: 10, delayMs: 3000 }
  );
  const profileB = await waitFor(
    "Bob profile persistence",
    async () => {
      const data = await gql(tokenB.token, GET_MY_PROFILE);
      assert(data.getMyProfile, "Bob profile not found");
      return data.getMyProfile;
    },
    { attempts: 10, delayMs: 3000 }
  );
  console.log("  Alice profile:", profileA);
  console.log("  Bob profile:", profileB);

  log("Step 5", `Alice (${tokenA.sub}) sends a follow request to Bob (${tokenB.sub})`);
  const followReq = await gql(tokenA.token, REQUEST_FOLLOW, { targetUserId: tokenB.sub });
  console.log("  Follow request:", followReq.requestFollow);
  assert(followReq.requestFollow, "requestFollow returned null");
  assert(followReq.requestFollow.status === "PENDING", "requestFollow did not return PENDING");

  log("Step 6", "Waiting for Bob's follow-request notification");
  const bobNotifications = await waitFor("Bob follow request notification", async () => {
    const data = await gql(tokenB.token, GET_MY_NOTIFICATIONS);
    const match = data.getMyNotifications?.items?.find(
      (item) =>
        item.type === "FOLLOW_REQUEST_RECEIVED" &&
        item.senderId === tokenA.sub &&
        item.recipientId === tokenB.sub
    );
    assert(match, "Bob follow-request notification not found");
    return data.getMyNotifications.items;
  });
  console.log("  Bob notifications:", JSON.stringify(bobNotifications, null, 2));

  log("Step 7", "Bob accepts the follow request");
  const accepted = await gql(tokenB.token, ACCEPT_FOLLOW, { requesterId: tokenA.sub });
  console.log("  Accepted follow:", accepted.acceptFollowRequest);
  assert(accepted.acceptFollowRequest, "acceptFollowRequest returned null");
  assert(
    accepted.acceptFollowRequest.status === "ACCEPTED",
    "acceptFollowRequest did not return ACCEPTED"
  );

  log("Step 8", "Querying Bob's followers");
  const followers = await gql(tokenB.token, GET_MY_FOLLOWERS);
  console.log("  Bob followers:", JSON.stringify(followers.getMyFollowers, null, 2));
  assert(followers.getMyFollowers, "getMyFollowers returned null");
  assert(
    followers.getMyFollowers.items.some((item) => item.user?.id === tokenA.sub),
    "Alice was not found in Bob's followers"
  );

  log("Step 9", "Querying Alice's followings");
  const followings = await gql(tokenA.token, GET_MY_FOLLOWINGS);
  console.log("  Alice followings:", JSON.stringify(followings.getMyFollowings, null, 2));
  assert(followings.getMyFollowings, "getMyFollowings returned null");
  assert(
    followings.getMyFollowings.items.some((item) => item.user?.id === tokenB.sub),
    "Bob was not found in Alice's followings"
  );

  log("Step 10", "Waiting for Alice's follow-accepted notification");
  const aliceNotifications = await waitFor("Alice follow accepted notification", async () => {
    const data = await gql(tokenA.token, GET_MY_NOTIFICATIONS);
    const match = data.getMyNotifications?.items?.find(
      (item) =>
        item.type === "FOLLOW_REQUEST_ACCEPTED" &&
        item.senderId === tokenB.sub &&
        item.recipientId === tokenA.sub
    );
    assert(match, "Alice follow-accepted notification not found");
    return data.getMyNotifications.items;
  });
  console.log("  Alice notifications:", JSON.stringify(aliceNotifications, null, 2));

  log("Step 11", "Verifying IAM-only mutation is blocked for Cognito JWTs");
  let blocked = false;
  try {
    await gql(tokenA.token, CREATE_NOTIFICATION_INTERNAL, {
      input: {
        id: `unauthorized-${runId}`,
        recipientId: tokenA.sub,
        senderId: tokenB.sub,
        type: "FOLLOW_REQUEST_ACCEPTED",
      },
    });
  } catch (error) {
    blocked =
      error.message.includes("Unauthorized") || error.message.includes("Not Authorized");
    if (!blocked) {
      throw error;
    }
  }
  assert(blocked, "IAM-only createNotificationInternal was callable with a Cognito JWT");

  console.log("\nPASS: verified profiles, follow graph, async notifications, and IAM-only access.");
}

main().catch((error) => {
  console.error("\nFAIL:", error);
  process.exit(1);
});
