import { defineAuth } from '@aws-amplify/backend';
import { preSignUpTrigger } from '../functions/preSignUp/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: { required: true, mutable: true },
    // `fullname` stays required for backward compat with existing users
    // (you can't downgrade a required standard attribute on an existing
    // Cognito pool). New signups send fullname=`${given} ${family}`.
    fullname: { required: true, mutable: true },
    givenName: { required: false, mutable: true },
    familyName: { required: false, mutable: true },
  },
  groups: ['admin', 'member'],
  triggers: {
    preSignUp: preSignUpTrigger,
  },
});
