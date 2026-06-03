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
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

import { auth } from './auth/resource';

const backend = defineBackend({
  auth,
});

// Signup is retired: the public app has no registration surface and admins are
// created via the AWS console (AdminCreateUser). Lock the pool to admin-only
// creation so the Cognito SignUp API can't be used to self-register either.
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };

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
const statsFn = apiHandler('statsFn', 'stats');
const verseFn = apiHandler('verseFn', 'verse');

// ---------- DDB grants (least-privilege) ----------

attendeesTable.grantReadWriteData(attendeesFn);
attendeesTable.grantReadData(meetingsFn); // validates attendeeIds on POST
attendeesTable.grantReadData(statsFn);

meetingsTable.grantReadWriteData(meetingsFn);
meetingsTable.grantReadData(statsFn);
meetingsTable.grantReadData(verseFn);

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
  stats: new LambdaIntegration(statsFn),
  verse: new LambdaIntegration(verseFn),
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

// /stats — public alongside the wheel; no member-only data.
api.root.addResource('stats').addMethod('GET', integ.stats, publicOpts);

// /verse — public (banner renders on the wheel/stats pages)
api.root.addResource('verse').addMethod('GET', integ.verse, publicOpts);

// ---------- Outputs ----------

backend.addOutput({
  custom: {
    apiUrl: api.url,
    apiRegion: Stack.of(api).region,
  },
});
