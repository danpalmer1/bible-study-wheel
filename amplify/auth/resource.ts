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
    givenName: { required: false, mutable: true },
    familyName: { required: false, mutable: true },
  },
  groups: ['admin', 'member'],
});
