import { defineFunction } from '@aws-amplify/backend';

export const adminUsersFn = defineFunction({
  name: 'adminUsers',
  entry: '../../../backend-aws/functions/adminUsers/index.js',
  runtime: 20,
});
