import { AppSyncClient, CreateDataSourceCommand, CreateFunctionCommand, UpdateFunctionCommand, CreateResolverCommand, UpdateResolverCommand, ListFunctionsCommand } from "@aws-sdk/client-appsync";
import fs from "fs";

const API_ID = "jqgomclmgrelphbq72uwns6oia";
const ROLE_ARN = "arn:aws:iam::461780750039:role/BuzzerLambdaRole";
const REGION = "ap-south-1";

const client = new AppSyncClient({ region: REGION });

async function main() {
  console.log("Creating Data Sources...");
  await client.send(new CreateDataSourceCommand({
    apiId: API_ID, name: "UsersTable", type: "AMAZON_DYNAMODB", serviceRoleArn: ROLE_ARN,
    dynamodbConfig: { tableName: "BuzzerUsers-dev", awsRegion: REGION }
  })).catch(e => console.log(e.message));

  await client.send(new CreateDataSourceCommand({
    apiId: API_ID, name: "FollowsTable", type: "AMAZON_DYNAMODB", serviceRoleArn: ROLE_ARN,
    dynamodbConfig: { tableName: "BuzzerFollows-dev", awsRegion: REGION }
  })).catch(e => console.log(e.message));

  await client.send(new CreateDataSourceCommand({
    apiId: API_ID, name: "NotificationsTable", type: "AMAZON_DYNAMODB", serviceRoleArn: ROLE_ARN,
    dynamodbConfig: { tableName: "BuzzerNotifications-dev", awsRegion: REGION }
  })).catch(e => console.log(e.message));

  await client.send(new CreateDataSourceCommand({
    apiId: API_ID, name: "SQSQueue", type: "HTTP", serviceRoleArn: ROLE_ARN,
    httpConfig: { endpoint: "https://sqs.ap-south-1.amazonaws.com", authorizationConfig: { authorizationType: "AWS_IAM", awsIamConfig: { signingRegion: REGION, signingServiceName: "sqs" } } }
  })).catch(e => console.log(e.message));

  await client.send(new CreateDataSourceCommand({
    apiId: API_ID, name: "NoneDS", type: "NONE"
  })).catch(e => console.log(e.message));

  console.log("Creating Functions...");
  const existingFunctions = await client.send(new ListFunctionsCommand({ apiId: API_ID }));
  
  const createFn = async (name, ds, path) => {
    try {
      const code = fs.readFileSync(path, "utf-8");
      const existing = existingFunctions.functions.find(f => f.name === name);
      if (existing) {
        const res = await client.send(new UpdateFunctionCommand({
          apiId: API_ID, name, functionId: existing.functionId, dataSourceName: ds,
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code
        }));
        return res?.functionConfiguration?.functionId;
      } else {
        const res = await client.send(new CreateFunctionCommand({
          apiId: API_ID, name, dataSourceName: ds,
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code
        }));
        return res?.functionConfiguration?.functionId;
      }
    } catch(e) {
      console.log("Function Error:", name, e.message);
    }
  };

  const f1 = await createFn("RequestFollowDDB", "FollowsTable", "amplify/backend/api/buzzertask/resolvers/Mutation.requestFollow.js");
  const f2 = await createFn("RequestFollowSQS", "SQSQueue", "amplify/backend/api/buzzertask/resolvers/Mutation.requestFollow.SQS.js");
  const f3 = await createFn("AcceptFollowDDB", "FollowsTable", "amplify/backend/api/buzzertask/resolvers/Mutation.acceptFollowRequest.js");
  const f4 = await createFn("AcceptFollowSQS", "SQSQueue", "amplify/backend/api/buzzertask/resolvers/Mutation.acceptFollowRequest.SQS.js");

  console.log("Creating Unit Resolvers...");
  const createRes = async (type, field, ds, path) => {
    try {
      const code = fs.readFileSync(path, "utf-8");
      try {
        await client.send(new UpdateResolverCommand({
          apiId: API_ID, typeName: type, fieldName: field, dataSourceName: ds,
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code
        }));
      } catch (e) {
        await client.send(new CreateResolverCommand({
          apiId: API_ID, typeName: type, fieldName: field, dataSourceName: ds,
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code
        }));
      }
    } catch(e) {
      console.log("Resolver Error:", field, e.message);
    }
  };

  await createRes("Query", "getMyFollowers", "FollowsTable", "amplify/backend/api/buzzertask/resolvers/Query.getMyFollowers.js");
  await createRes("Query", "getMyFollowings", "FollowsTable", "amplify/backend/api/buzzertask/resolvers/Query.getMyFollowings.js");
  await createRes("Subscription", "onFollowAccepted", "NoneDS", "amplify/backend/api/buzzertask/resolvers/Subscription.onFollowAccepted.js");
  await createRes("Subscription", "onNotification", "NoneDS", "amplify/backend/api/buzzertask/resolvers/Subscription.onNotification.js");
  await createRes("Mutation", "createNotificationInternal", "NotificationsTable", "amplify/backend/api/buzzertask/resolvers/Mutation.createNotificationInternal.js");
  await createRes("UserFollowEdge", "user", "UsersTable", "amplify/backend/api/buzzertask/resolvers/UserFollowEdge.user.js");

  console.log("Creating Pipeline Resolvers...");
  const createPipe = async (field, functions) => {
    try {
      try {
        await client.send(new UpdateResolverCommand({
          apiId: API_ID, typeName: "Mutation", fieldName: field, kind: "PIPELINE",
          pipelineConfig: { functions },
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code: "export function request(ctx) { return {}; } export function response(ctx) { return ctx.prev.result; }"
        }));
      } catch (e) {
        await client.send(new CreateResolverCommand({
          apiId: API_ID, typeName: "Mutation", fieldName: field, kind: "PIPELINE",
          pipelineConfig: { functions },
          runtime: { name: "APPSYNC_JS", runtimeVersion: "1.0.0" },
          code: "export function request(ctx) { return {}; } export function response(ctx) { return ctx.prev.result; }"
        }));
      }
    } catch(e) {
      console.log("Error Pipeline:", field, e.message);
    }
  };

  if (f1 && f2) await createPipe("requestFollow", [f1, f2]);
  if (f3 && f4) await createPipe("acceptFollowRequest", [f3, f4]);

  console.log("Done!");
}

main();
