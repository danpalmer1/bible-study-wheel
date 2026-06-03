import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: { required: true, mutable: true },
    // `fullname` stays required for backward compat with existing users
    // (you can't downgrade a required standard attribute on an existing
    // Cognito pool).
    fullname: { required: true, mutable: true },
    // Do NOT declare givenName/familyName here. The PROD pool was created
    // with only email + name configured; adding standard attributes to an
    // existing pool is an unsupported Cognito update and fails every deploy
    // with "Invalid AttributeDataType" (CFNUpdateNotSupportedError). They
    // still exist as standard attributes and remain readable — the app reads
    // `name` with a given/family fallback — so there's no need to declare them.
  },
  groups: ['admin', 'member'],
});
