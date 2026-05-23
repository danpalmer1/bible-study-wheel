import { defineBackend } from '@aws-amplify/backend';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Stack } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
  type MethodOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

import { auth } from './auth/resource';
import { preSignUpTrigger } from './functions/preSignUp/resource';

const backend = defineBackend({
  auth,
  preSignUpTrigger,
});

// Disable Cognito's self-confirm email flow. Default user pool config has
// `email` in AutoVerifiedAttributes, which triggers a verification-code email
// the user could enter to bypass admin approval. With this empty, signups
// stay UNCONFIRMED with no code email sent until AdminConfirmSignUp.
// AttributesRequireVerificationBeforeUpdate must be a subset of
// AutoVerifiedAttributes, so clear both. Email-based password reset is
// unavailable as a result; admin must reset passwords via
// AdminSetUserPassword.
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.autoVerifiedAttributes = [];
cfnUserPool.userAttributeUpdateSettings = {
  attributesRequireVerificationBeforeUpdate: [],
};

// All API resources live in this stack — tables, Lambdas, REST API. Keeping
// them co-located prevents the cross-stack reference cycle that arises when
// Lambda env vars and table grants span stacks.
const apiStack = backend.createStack('BibleStudyApiStack');

// ---------- DynamoDB tables ----------

const attendeesTable = new Table(apiStack, 'AttendeesTable', {
  partitionKey: { name: 'attendeeId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

const meetingsTable = new Table(apiStack, 'MeetingsTable', {
  partitionKey: { name: 'meetingId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

const spinsTable = new Table(apiStack, 'SpinsTable', {
  partitionKey: { name: 'spinId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

// ---------- API Lambdas ----------
// Raw NodejsFunction (not defineFunction) — keeps the Lambdas in apiStack
// alongside the tables they read/write, so grants and env vars stay
// intra-stack. NodejsFunction defaults to externalizing @aws-sdk/* (Lambda
// Node 20 runtime provides them), so we don't ship the SDK with each fn.

const __dirname = dirname(fileURLToPath(import.meta.url));
const handlersRoot = resolve(__dirname, '../backend-aws/functions');

const tableEnv = {
  ATTENDEES_TABLE: attendeesTable.tableName,
  MEETINGS_TABLE: meetingsTable.tableName,
  SPINS_TABLE: spinsTable.tableName,
};

function apiHandler(id: string, dir: string, extraEnv: Record<string, string> = {}) {
  return new NodejsFunction(apiStack, id, {
    entry: resolve(handlersRoot, dir, 'index.js'),
    runtime: Runtime.NODEJS_20_X,
    environment: { ...tableEnv, ...extraEnv },
  });
}

const attendeesFn = apiHandler('attendeesFn', 'attendees');
const meetingsFn = apiHandler('meetingsFn', 'meetings');
const spinsFn = apiHandler('spinsFn', 'spins');
const statsFn = apiHandler('statsFn', 'stats');
const verseFn = apiHandler('verseFn', 'verse');
const adminUsersFn = apiHandler('adminUsersFn', 'adminUsers', {
  USER_POOL_ID: backend.auth.resources.userPool.userPoolId,
});

// ---------- DDB grants (least-privilege) ----------

attendeesTable.grantReadWriteData(attendeesFn);
attendeesTable.grantReadData(meetingsFn); // validates attendeeIds on POST
attendeesTable.grantReadData(spinsFn); // validates attendeeIds on POST
attendeesTable.grantReadData(statsFn);

meetingsTable.grantReadWriteData(meetingsFn);
meetingsTable.grantReadData(statsFn);
meetingsTable.grantReadData(verseFn);

spinsTable.grantReadWriteData(spinsFn);
spinsTable.grantReadData(statsFn);

// adminUsers calls Cognito IDP scoped to this user pool.
adminUsersFn.role!.addToPrincipalPolicy(
  new PolicyStatement({
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminConfirmSignUp',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminDeleteUser',
    ],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);

// preSignUp may optionally SES-notify the admin if ADMIN_NOTIFY_EMAIL is set
// on the Lambda. Grant SES so it's ready when env vars are added later.
// The trigger Lambda lives in its own stack (function); attaching the
// policy from apiStack creates apiStack→function (one-way, no cycle).
backend.preSignUpTrigger.resources.lambda.role!.addToPrincipalPolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

// ---------- REST API ----------

const api = new RestApi(apiStack, 'BibleStudyApi', {
  restApiName: 'biblestudyapi',
  deployOptions: { stageName: 'dev' },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: Cors.DEFAULT_HEADERS,
  },
});

const cognitoAuth = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuth', {
  cognitoUserPools: [backend.auth.resources.userPool],
});

const authed: MethodOptions = {
  authorizationType: AuthorizationType.COGNITO,
  authorizer: cognitoAuth,
};

const publicOpts: MethodOptions = {
  authorizationType: AuthorizationType.NONE,
};

const integ = {
  attendees: new LambdaIntegration(attendeesFn),
  meetings: new LambdaIntegration(meetingsFn),
  spins: new LambdaIntegration(spinsFn),
  stats: new LambdaIntegration(statsFn),
  verse: new LambdaIntegration(verseFn),
  adminUsers: new LambdaIntegration(adminUsersFn),
};

// /attendees, /attendees/{id}
// GET is public so the unauthenticated wheel page can render the roster.
// Writes (POST/PUT) still require an admin-group Cognito token.
const attendeesRoot = api.root.addResource('attendees');
attendeesRoot.addMethod('GET', integ.attendees, publicOpts);
attendeesRoot.addMethod('POST', integ.attendees, authed);
attendeesRoot.addResource('{id}').addMethod('PUT', integ.attendees, authed);

// /meetings, /meetings/{id}
const meetingsRoot = api.root.addResource('meetings');
meetingsRoot.addMethod('GET', integ.meetings, authed);
meetingsRoot.addMethod('POST', integ.meetings, authed);
meetingsRoot.addResource('{id}').addMethod('DELETE', integ.meetings, authed);

// /spins, /spins/latest
const spinsRoot = api.root.addResource('spins');
spinsRoot.addMethod('POST', integ.spins, authed);
spinsRoot.addResource('latest').addMethod('GET', integ.spins, authed);

// /stats
api.root.addResource('stats').addMethod('GET', integ.stats, authed);

// /verse — public (banner renders on /login)
api.root.addResource('verse').addMethod('GET', integ.verse, publicOpts);

// /users/pending, /users/{id}/approve, /users/{id}/reject
const usersRoot = api.root.addResource('users');
usersRoot.addResource('pending').addMethod('GET', integ.adminUsers, authed);
const usersId = usersRoot.addResource('{id}');
usersId.addResource('approve').addMethod('POST', integ.adminUsers, authed);
usersId.addResource('reject').addMethod('POST', integ.adminUsers, authed);

// ---------- Outputs ----------

backend.addOutput({
  custom: {
    apiUrl: api.url,
    apiRegion: Stack.of(api).region,
  },
});
