import { Amplify } from "https://esm.sh/aws-amplify@6";
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "https://esm.sh/aws-amplify@6/auth";
import { generateClient } from "https://esm.sh/aws-amplify@6/api";
import awsExports from "./aws-exports.js";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsExports.aws_user_pools_id,
      userPoolClientId: awsExports.aws_user_pools_web_client_id,
      loginWith: { email: true },
    },
  },
  API: {
    GraphQL: {
      endpoint: awsExports.aws_appsync_graphqlEndpoint,
      region: awsExports.aws_appsync_region,
      defaultAuthMode: "userPool",
    },
  },
});

const client = generateClient();

const GET_MY_PROFILE = /* GraphQL */ `
  query GetMyProfile {
    getMyProfile {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
    }
  }
`;

const GET_MY_FOLLOWERS = /* GraphQL */ `
  query GetMyFollowers($limit: Int) {
    getMyFollowers(limit: $limit) {
      items {
        user { id username displayName email }
        followedAt
        status
      }
    }
  }
`;

const GET_MY_FOLLOWINGS = /* GraphQL */ `
  query GetMyFollowings($limit: Int) {
    getMyFollowings(limit: $limit) {
      items {
        user { id username displayName email }
        followedAt
        status
      }
    }
  }
`;

const GET_MY_PENDING = /* GraphQL */ `
  query GetMyPendingFollowRequests($limit: Int) {
    getMyPendingFollowRequests(limit: $limit) {
      items {
        user { id username displayName email }
        followedAt
        status
      }
    }
  }
`;

const GET_MY_NOTIFICATIONS = /* GraphQL */ `
  query GetMyNotifications($limit: Int) {
    getMyNotifications(limit: $limit) {
      items {
        id
        recipientId
        senderId
        type
        read
        createdAt
      }
    }
  }
`;

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
  mutation AcceptFollowRequest($requesterId: ID!) {
    acceptFollowRequest(requesterId: $requesterId) {
      requesterId
      targetId
      status
      updatedAt
    }
  }
`;

const ON_FOLLOW_ACCEPTED = /* GraphQL */ `
  subscription OnFollowAccepted($requesterId: ID!) {
    onFollowAccepted(requesterId: $requesterId) {
      requesterId
      targetId
      status
      updatedAt
    }
  }
`;

const ON_NOTIFICATION = /* GraphQL */ `
  subscription OnNotification($recipientId: ID!) {
    onNotification(recipientId: $recipientId) {
      id
      recipientId
      senderId
      type
      read
      createdAt
    }
  }
`;

const $ = (id) => document.getElementById(id);

function showMessage(id, text, isError = false) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.textContent = text;
  el.style.color = isError ? "var(--primary)" : "var(--text-muted)";
}

function renderUserRow(user, actionHtml = "") {
  const display = user?.displayName || user?.username || "Unknown";
  const username = user?.username || user?.id?.slice(0, 8) || "unknown";
  return `
    <div class="user-row">
      <div class="avatar">${display[0].toUpperCase()}</div>
      <div class="user-row-info">
        <div class="user-row-name">${display}</div>
        <div class="user-row-handle">@${username}</div>
      </div>
      ${actionHtml}
    </div>
  `;
}

function renderNotification(notification) {
  const labelByType = {
    FOLLOW_REQUEST_RECEIVED: "sent you a follow request",
    FOLLOW_REQUEST_ACCEPTED: "accepted your follow request",
  };

  return `
    <div class="user-row">
      <div class="avatar">${notification.type === "FOLLOW_REQUEST_ACCEPTED" ? "A" : "F"}</div>
      <div class="user-row-info">
        <div class="user-row-name">${notification.senderId.slice(0, 8)} ${labelByType[notification.type] || notification.type}</div>
        <div class="user-row-handle">${new Date(notification.createdAt).toLocaleString()}</div>
      </div>
    </div>
  `;
}

async function requireSession() {
  const current = await getCurrentUser();
  const session = await fetchAuthSession();
  return {
    username: current.username,
    sub: session.tokens?.idToken?.payload?.sub,
  };
}

export async function initDashboard() {
  let session;
  try {
    session = await requireSession();
  } catch {
    window.location.href = "./auth.html";
    return;
  }

  const profileRes = await client.graphql({ query: GET_MY_PROFILE });
  const profile = profileRes.data.getMyProfile;

  if ($("nav-avatar")) {
    $("nav-avatar").textContent = (profile?.displayName || profile?.username || "U")[0].toUpperCase();
  }

  async function refreshLists() {
    const [followersRes, followingsRes, pendingRes, notificationsRes] = await Promise.all([
      client.graphql({ query: GET_MY_FOLLOWERS, variables: { limit: 50 } }),
      client.graphql({ query: GET_MY_FOLLOWINGS, variables: { limit: 50 } }),
      client.graphql({ query: GET_MY_PENDING, variables: { limit: 50 } }),
      client.graphql({ query: GET_MY_NOTIFICATIONS, variables: { limit: 50 } }),
    ]);

    const followers = followersRes.data.getMyFollowers.items;
    const followings = followingsRes.data.getMyFollowings.items;
    const pending = pendingRes.data.getMyPendingFollowRequests.items;
    const notifications = notificationsRes.data.getMyNotifications.items;

    if ($("stat-followers")) $("stat-followers").textContent = String(followers.length);
    if ($("stat-following")) $("stat-following").textContent = String(followings.length);
    if ($("stat-notifs")) $("stat-notifs").textContent = String(notifications.length);
    if ($("notif-badge-count")) $("notif-badge-count").textContent = String(notifications.length);
    if ($("notif-count")) {
      $("notif-count").textContent = String(notifications.length);
      $("notif-count").style.display = notifications.length ? "flex" : "none";
    }
    if ($("pending-count")) $("pending-count").textContent = String(pending.length);

    $("followers-list").innerHTML = followers.length
      ? followers.map((edge) => renderUserRow(edge.user)).join("")
      : '<p class="text-muted text-sm">No followers yet.</p>';

    $("followings-list").innerHTML = followings.length
      ? followings.map((edge) => renderUserRow(edge.user)).join("")
      : '<p class="text-muted text-sm">Not following anyone yet.</p>';

    $("pending-list").innerHTML = pending.length
      ? pending
          .map((edge) =>
            renderUserRow(
              edge.user,
              `<button class="btn btn-gold btn-sm accept-follow" data-requester-id="${edge.user.id}" type="button">Accept</button>`
            )
          )
          .join("")
      : '<p class="text-muted text-sm">No pending requests.</p>';

    $("notif-list").innerHTML = notifications.length
      ? notifications.map(renderNotification).join("")
      : '<p class="text-muted text-sm">No notifications yet.</p>';

    document.querySelectorAll(".accept-follow").forEach((button) => {
      button.addEventListener("click", async () => {
        await client.graphql({
          query: ACCEPT_FOLLOW,
          variables: { requesterId: button.dataset.requesterId },
        });
        await refreshLists();
      });
    });
  }

  $("btn-follow")?.addEventListener("click", async () => {
    const targetId = $("target-id").value.trim();
    if (!targetId) {
      showMessage("follow-result", "Enter a target user id.", true);
      return;
    }

    try {
      const response = await client.graphql({
        query: REQUEST_FOLLOW,
        variables: { targetUserId: targetId },
      });
      showMessage("follow-result", `Request created with status ${response.data.requestFollow.status}.`);
      $("target-id").value = "";
    } catch (error) {
      showMessage("follow-result", error.errors?.[0]?.message || error.message, true);
    }
  });

  client.graphql({
    query: ON_NOTIFICATION,
    variables: { recipientId: session.sub },
  }).subscribe({
    next: refreshLists,
    error: (error) => console.error("notification subscription failed", error),
  });

  client.graphql({
    query: ON_FOLLOW_ACCEPTED,
    variables: { requesterId: session.sub },
  }).subscribe({
    next: refreshLists,
    error: (error) => console.error("follow accepted subscription failed", error),
  });

  await refreshLists();
}

export function initAuthPage() {
  const params = new URLSearchParams(window.location.search);
  const showSignup = params.get("mode") === "signup";

  const loginForm = $("login-form");
  const signupForm = $("signup-form");
  const confirmForm = $("confirm-form");

  function setMode(mode) {
    const signup = mode === "signup";
    $("auth-tab-login").classList.toggle("active", !signup);
    $("auth-tab-signup").classList.toggle("active", signup);
    loginForm.style.display = signup ? "none" : "block";
    signupForm.style.display = signup ? "block" : "none";
  }

  setMode(showSignup ? "signup" : "login");

  $("auth-tab-login").addEventListener("click", () => setMode("login"));
  $("auth-tab-signup").addEventListener("click", () => setMode("signup"));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await signIn({
        username: $("login-email").value.trim(),
        password: $("login-password").value,
      });
      window.location.href = "./dashboard.html";
    } catch (error) {
      showMessage("auth-status", error.message || "Login failed.", true);
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await signUp({
        username: $("signup-email").value.trim(),
        password: $("signup-password").value,
        options: {
          userAttributes: {
            email: $("signup-email").value.trim(),
          },
        },
      });
      confirmForm.style.display = "block";
      $("confirm-email").value = $("signup-email").value.trim();
      showMessage("auth-status", "Account created. Enter the confirmation code sent by Cognito.");
    } catch (error) {
      showMessage("auth-status", error.message || "Sign up failed.", true);
    }
  });

  confirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await confirmSignUp({
        username: $("confirm-email").value.trim(),
        confirmationCode: $("confirm-code").value.trim(),
      });
      showMessage("auth-status", "Account confirmed. You can log in now.");
      setMode("login");
    } catch (error) {
      showMessage("auth-status", error.message || "Confirmation failed.", true);
    }
  });
}

export async function initProfilePage() {
  try {
    await requireSession();
  } catch {
    window.location.href = "./auth.html";
    return;
  }

  try {
    const response = await client.graphql({ query: GET_MY_PROFILE });
    const profile = response.data.getMyProfile;
    $("profile-avatar").textContent = (profile.displayName || profile.username || "U")[0].toUpperCase();
    $("profile-name").textContent = profile.displayName || profile.username;
    $("profile-handle").textContent = `@${profile.username}`;
    $("profile-id").value = profile.id;
    $("profile-email").value = profile.email;
    showMessage("profile-status", `Member since ${new Date(profile.createdAt).toLocaleDateString()}.`);
  } catch (error) {
    showMessage("profile-status", error.errors?.[0]?.message || error.message, true);
  }

  $("btn-signout").addEventListener("click", async () => {
    await signOut();
    window.location.href = "./index.html";
  });
}
