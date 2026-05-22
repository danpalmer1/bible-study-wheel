import { defineAuth } from '@aws-amplify/backend';
import { preSignUpTrigger } from '../functions/preSignUp/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: { required: true, mutable: true },
    fullname: { required: true, mutable: true },
  },
  groups: ['admin', 'member'],
  triggers: {
    preSignUp: preSignUpTrigger,
  },
});
