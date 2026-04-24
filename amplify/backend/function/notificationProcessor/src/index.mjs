

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
