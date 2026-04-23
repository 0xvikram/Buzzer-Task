/**
 * notificationProcessor
 *
 * SQS consumer Lambda. Receives notification events published by AppSync
 * resolvers (requestFollow, acceptFollowRequest) and writes Notification
 * records by calling the AppSync IAM-authenticated mutation
 * `createNotificationInternal`.
 *
 * Why call AppSync instead of writing directly to DynamoDB?
 *   AppSync GraphQL subscriptions (onNotification) are triggered by MUTATIONS,
 *   not by DynamoDB writes. If we wrote directly to DDB, the real-time
 *   subscription would never fire. The IAM mutation path is the only correct
 *   choice to make subscriptions work.
 *
 * Why IAM auth on the mutation?
 *   `createNotificationInternal` is decorated with @aws_iam only — no
 *   @aws_cognito_user_pools. This means NO client holding a Cognito JWT can
 *   call it. Only AWS services with the correct IAM role (this Lambda) can.
 *
 * Idempotency:
 *   Each notification has a UUID `id`. The DynamoDB resolver uses
 *   attribute_not_exists(id) so duplicate SQS deliveries are safe.
 */

import { randomUUID } from "crypto";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT;
const REGION = process.env.AWS_REGION || "ap-south-1";

const CREATE_NOTIFICATION_MUTATION = /* GraphQL */ `
  mutation CreateNotificationInternal($input: CreateNotificationInput!) {
    createNotificationInternal(input: $input) {
      id
      recipientId
      senderId
      type
      read
      createdAt
    }
  }
`;

/**
 * Signs and sends a GraphQL request to AppSync using IAM (SigV4) auth.
 * No hardcoded credentials — uses the Lambda execution role automatically.
 */
async function callAppSyncIAM(query, variables) {
  const url = new URL(APPSYNC_ENDPOINT);
  const body = JSON.stringify({ query, variables });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: "appsync",
    sha256: Sha256,
  });

  const signed = await signer.sign({
    method: "POST",
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      "Content-Type": "application/json",
      host: url.hostname,
    },
    body,
  });

  const response = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: signed.headers,
    body,
  });

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`AppSync error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

export const handler = async (event) => {
  for (const record of event.Records) {
    let payload;

    try {
      payload = JSON.parse(record.body);
    } catch (err) {
      console.error("[notificationProcessor] Failed to parse SQS record body:", record.body);
      // Skip malformed messages — don't throw, avoids DLQ for parse errors
      continue;
    }

    const { recipientId, senderId, type } = payload;

    if (!recipientId || !senderId || !type) {
      console.error("[notificationProcessor] Missing required fields in payload:", payload);
      continue;
    }

    try {
      await callAppSyncIAM(CREATE_NOTIFICATION_MUTATION, {
        input: {
          id: randomUUID(),      // UUID ensures idempotency at DDB level
          recipientId,
          senderId,
          type,
        },
      });

      console.log(
        `[notificationProcessor] Created ${type} notification for recipient=${recipientId}`
      );
    } catch (err) {
      // Throw on AppSync errors so SQS retries and eventually routes to DLQ
      console.error(
        `[notificationProcessor] Failed to create notification for recipient=${recipientId}:`,
        err
      );
      throw err;
    }
  }
};
