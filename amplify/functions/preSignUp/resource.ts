import { defineFunction } from '@aws-amplify/backend';

// Wraps the existing CommonJS handler in backend-aws/functions/preSignUp/index.js.
// Bundled by esbuild; the relative `require('@aws-sdk/...')` calls resolve against
// the entry file's original directory.
export const preSignUpTrigger = defineFunction({
  name: 'preSignUpTrigger',
  entry: '../../../backend-aws/functions/preSignup/index.js',
  runtime: 20,
  // ADMIN_NOTIFY_EMAIL / FROM_EMAIL are optional — if unset, the handler skips
  // the SES call entirely. Set them later via the Lambda console or by editing
  // amplify/backend.ts to use secret('ADMIN_NOTIFY_EMAIL').
});
