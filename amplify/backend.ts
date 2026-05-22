import { defineBackend } from '@aws-amplify/backend';
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
import type { Function as LambdaFn } from 'aws-cdk-lib/aws-lambda';

import { auth } from './auth/resource';
import { preSignUpTrigger } from './functions/preSignUp/resource';
import { attendeesFn } from './functions/attendees/resource';
import { meetingsFn } from './functions/meetings/resource';
import { spinsFn } from './functions/spins/resource';
import { statsFn } from './functions/stats/resource';
import { verseFn } from './functions/verse/resource';
import { adminUsersFn } from './functions/adminUsers/resource';

const backend = defineBackend({
  auth,
  preSignUpTrigger,
  attendeesFn,
  meetingsFn,
  spinsFn,
  statsFn,
  verseFn,
  adminUsersFn,
});

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

// ---------- Wire env vars + IAM ----------

// resources.lambda is typed as IFunction, but defineFunction always produces a
// concrete Function — cast so we can call addEnvironment.
const apiLambdas = {
  attendees: backend.attendeesFn.resources.lambda as LambdaFn,
  meetings: backend.meetingsFn.resources.lambda as LambdaFn,
  spins: backend.spinsFn.resources.lambda as LambdaFn,
  stats: backend.statsFn.resources.lambda as LambdaFn,
  verse: backend.verseFn.resources.lambda as LambdaFn,
  adminUsers: backend.adminUsersFn.resources.lambda as LambdaFn,
};
const preSignUpLambda = backend.preSignUpTrigger.resources.lambda as LambdaFn;

// All API lambdas see all three table names; each Lambda only uses the ones
// it touches, but a single shared env shape keeps the handlers simple.
for (const fn of Object.values(apiLambdas)) {
  fn.addEnvironment('ATTENDEES_TABLE', attendeesTable.tableName);
  fn.addEnvironment('MEETINGS_TABLE', meetingsTable.tableName);
  fn.addEnvironment('SPINS_TABLE', spinsTable.tableName);
}

// DDB grants — least-privilege per handler.
attendeesTable.grantReadWriteData(apiLambdas.attendees);
attendeesTable.grantReadData(apiLambdas.meetings); // validates attendeeIds
attendeesTable.grantReadData(apiLambdas.spins); // validates attendeeIds
attendeesTable.grantReadData(apiLambdas.stats);

meetingsTable.grantReadWriteData(apiLambdas.meetings);
meetingsTable.grantReadData(apiLambdas.stats);
meetingsTable.grantReadData(apiLambdas.verse);

spinsTable.grantReadWriteData(apiLambdas.spins);
spinsTable.grantReadData(apiLambdas.stats);

// adminUsers needs the user pool ID + Cognito IDP perms.
apiLambdas.adminUsers.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId
);
apiLambdas.adminUsers.role!.addToPrincipalPolicy(
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

// preSignUp may optionally send SES notifications when ADMIN_NOTIFY_EMAIL is
// set on the Lambda. Grant SES perms so the user can wire that up later
// without re-deploying IAM.
preSignUpLambda.role!.addToPrincipalPolicy(
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
  attendees: new LambdaIntegration(apiLambdas.attendees),
  meetings: new LambdaIntegration(apiLambdas.meetings),
  spins: new LambdaIntegration(apiLambdas.spins),
  stats: new LambdaIntegration(apiLambdas.stats),
  verse: new LambdaIntegration(apiLambdas.verse),
  adminUsers: new LambdaIntegration(apiLambdas.adminUsers),
};

// /attendees, /attendees/{id}
const attendeesRoot = api.root.addResource('attendees');
attendeesRoot.addMethod('GET', integ.attendees, authed);
attendeesRoot.addMethod('POST', integ.attendees, authed);
const attendeesId = attendeesRoot.addResource('{id}');
attendeesId.addMethod('PUT', integ.attendees, authed);

// /meetings, /meetings/{id}
const meetingsRoot = api.root.addResource('meetings');
meetingsRoot.addMethod('GET', integ.meetings, authed);
meetingsRoot.addMethod('POST', integ.meetings, authed);
const meetingsId = meetingsRoot.addResource('{id}');
meetingsId.addMethod('DELETE', integ.meetings, authed);

// /spins, /spins/latest
const spinsRoot = api.root.addResource('spins');
spinsRoot.addMethod('POST', integ.spins, authed);
const spinsLatest = spinsRoot.addResource('latest');
spinsLatest.addMethod('GET', integ.spins, authed);

// /stats
const statsRoot = api.root.addResource('stats');
statsRoot.addMethod('GET', integ.stats, authed);

// /verse — public (banner renders on /login)
const verseRoot = api.root.addResource('verse');
verseRoot.addMethod('GET', integ.verse, publicOpts);

// /users/pending, /users/{id}/approve, /users/{id}/reject
const usersRoot = api.root.addResource('users');
const usersPending = usersRoot.addResource('pending');
usersPending.addMethod('GET', integ.adminUsers, authed);
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
