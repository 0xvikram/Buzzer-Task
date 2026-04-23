/**
 * postConfirmationTrigger
 *
 * Cognito Post-Confirmation Lambda trigger.
 * Fires after a user successfully confirms their account (email verification).
 * Persists the user record to DynamoDB so the rest of the system can reference it.
 *
 * Why this approach instead of inline creation:
 *   - Cognito is the source of truth for identity; DynamoDB is the profile store.
 *   - Using a trigger (not a client mutation) means the user record is ALWAYS
 *     created regardless of which client/SDK the user registered through.
 *   - The ConditionExpression makes this idempotent — safe to retry on failure.
 */

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.USERS_TABLE;

export const handler = async (event) => {
  const { sub, email, preferred_username, name } = event.request.userAttributes;

  // Derive a username from what's available — prefer preferred_username, fall back to email prefix
  const username = preferred_username || email.split("@")[0];

  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          id: sub, // Cognito sub — stable, immutable unique identifier
          email,
          username,
          displayName: name || username,
          createdAt: new Date().toISOString(),
        }),
        // Idempotent: if this Lambda fires twice (Cognito retry), don't overwrite
        ConditionExpression: "attribute_not_exists(id)",
      })
    );

    console.log(`[postConfirmationTrigger] Created user record for sub=${sub}`);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      // User already exists — this is fine, do nothing
      console.log(`[postConfirmationTrigger] User ${sub} already exists, skipping`);
    } else {
      // Rethrow so Cognito sees the failure and can retry / alert
      console.error(`[postConfirmationTrigger] Failed to create user ${sub}:`, err);
      throw err;
    }
  }

  // MUST return the event object — Cognito triggers require this
  return event;
};
