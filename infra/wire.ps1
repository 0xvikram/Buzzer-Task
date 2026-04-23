$API_ID = "jqgomclmgrelphbq72uwns6oia"
$ROLE_ARN = "arn:aws:iam::461780750039:role/BuzzerLambdaRole"
$REGION = "ap-south-1"

# 1. Create Data Sources
Write-Host "Creating Data Sources..."
aws appsync create-data-source --api-id $API_ID --name UsersTable --type AMAZON_DYNAMODB --service-role-arn $ROLE_ARN --dynamodb-config tableName=BuzzerUsers-dev,awsRegion=$REGION --region $REGION | Out-Null
aws appsync create-data-source --api-id $API_ID --name FollowsTable --type AMAZON_DYNAMODB --service-role-arn $ROLE_ARN --dynamodb-config tableName=BuzzerFollows-dev,awsRegion=$REGION --region $REGION | Out-Null
aws appsync create-data-source --api-id $API_ID --name NotificationsTable --type AMAZON_DYNAMODB --service-role-arn $ROLE_ARN --dynamodb-config tableName=BuzzerNotifications-dev,awsRegion=$REGION --region $REGION | Out-Null
aws appsync create-data-source --api-id $API_ID --name SQSQueue --type HTTP --service-role-arn $ROLE_ARN --http-config endpoint="https://sqs.ap-south-1.amazonaws.com",authorizationConfig={authorizationType="AWS_IAM",awsIamConfig={signingRegion=$REGION,signingServiceName="sqs"}} --region $REGION | Out-Null
aws appsync create-data-source --api-id $API_ID --name NoneDS --type NONE --region $REGION | Out-Null

# 2. Create Functions (for pipeline resolvers)
Write-Host "Creating Functions..."
$fn1 = aws appsync create-function --api-id $API_ID --name RequestFollowDDB --data-source-name FollowsTable --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Mutation.requestFollow.js -Raw)" --region $REGION | ConvertFrom-Json
$fn2 = aws appsync create-function --api-id $API_ID --name RequestFollowSQS --data-source-name SQSQueue --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Mutation.requestFollow.SQS.js -Raw)" --region $REGION | ConvertFrom-Json
$fn3 = aws appsync create-function --api-id $API_ID --name AcceptFollowDDB --data-source-name FollowsTable --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Mutation.acceptFollowRequest.js -Raw)" --region $REGION | ConvertFrom-Json
$fn4 = aws appsync create-function --api-id $API_ID --name AcceptFollowSQS --data-source-name SQSQueue --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Mutation.acceptFollowRequest.SQS.js -Raw)" --region $REGION | ConvertFrom-Json

# 3. Create Unit Resolvers
Write-Host "Creating Unit Resolvers..."
aws appsync create-resolver --api-id $API_ID --type-name Query --field-name getMyFollowers --data-source-name FollowsTable --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Query.getMyFollowers.js -Raw)" --region $REGION | Out-Null
aws appsync create-resolver --api-id $API_ID --type-name Query --field-name getMyFollowings --data-source-name FollowsTable --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Query.getMyFollowings.js -Raw)" --region $REGION | Out-Null
aws appsync create-resolver --api-id $API_ID --type-name Subscription --field-name onFollowAccepted --data-source-name NoneDS --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Subscription.onFollowAccepted.js -Raw)" --region $REGION | Out-Null
aws appsync create-resolver --api-id $API_ID --type-name Subscription --field-name onNotification --data-source-name NoneDS --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Subscription.onNotification.js -Raw)" --region $REGION | Out-Null
aws appsync create-resolver --api-id $API_ID --type-name Mutation --field-name createNotificationInternal --data-source-name NotificationsTable --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "$(Get-Content amplify\backend\api\BuzzerAPI\resolvers\Mutation.createNotificationInternal.js -Raw)" --region $REGION | Out-Null

# 4. Create Pipeline Resolvers
Write-Host "Creating Pipeline Resolvers..."
aws appsync create-resolver --api-id $API_ID --type-name Mutation --field-name requestFollow --kind PIPELINE --pipeline-config functions=[$($fn1.FunctionConfiguration.FunctionId),$($fn2.FunctionConfiguration.FunctionId)] --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "export function request(ctx) { return {}; } export function response(ctx) { return ctx.prev.result; }" --region $REGION | Out-Null
aws appsync create-resolver --api-id $API_ID --type-name Mutation --field-name acceptFollowRequest --kind PIPELINE --pipeline-config functions=[$($fn3.FunctionConfiguration.FunctionId),$($fn4.FunctionConfiguration.FunctionId)] --runtime name=APPSYNC_JS,runtimeVersion=1.0.0 --code "export function request(ctx) { return {}; } export function response(ctx) { return ctx.prev.result; }" --region $REGION | Out-Null

Write-Host "Done! All resolvers and data sources wired."
