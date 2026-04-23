import { AmplifyAuthCognitoStackTemplate } from "@aws-amplify/cli-extensibility-helper";
import { Fn } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as path from "path";

export function override(resources: AmplifyAuthCognitoStackTemplate) {
  const scope = resources as unknown as any;
  const envName = Fn.ref("env");

  const usersTable = new Table(scope, "BuzzerUsersTable", {
    tableName: Fn.join("", ["BuzzerUsers-", envName]),
    partitionKey: { name: "id", type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
  });

  const postConfirmation = new LambdaFunction(scope, "BuzzerPostConfirmationTrigger", {
    functionName: Fn.join("", ["buzzer-post-confirmation-", envName]),
    runtime: Runtime.NODEJS_20_X,
    handler: "src/index.handler",
    code: Code.fromAsset(path.join(__dirname, "..", "..", "function", "postConfirmationTrigger")),
    environment: {
      USERS_TABLE: usersTable.tableName,
    },
  });

  usersTable.grantWriteData(postConfirmation);

  postConfirmation.addPermission("AllowCognitoInvokePostConfirmation", {
    principal: new ServicePrincipal("cognito-idp.amazonaws.com"),
    sourceArn: resources.userPool.attrArn,
  });

  resources.userPool.lambdaConfig = {
    ...(resources.userPool.lambdaConfig || {}),
    postConfirmation: postConfirmation.functionArn,
  };
}
