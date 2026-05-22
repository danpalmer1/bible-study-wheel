import { defineFunction } from '@aws-amplify/backend';

export const spinsFn = defineFunction({
  name: 'spins',
  entry: '../../../backend-aws/functions/spins/index.js',
  runtime: 20,
});
