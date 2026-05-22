import { defineFunction } from '@aws-amplify/backend';

export const statsFn = defineFunction({
  name: 'stats',
  entry: '../../../backend-aws/functions/stats/index.js',
  runtime: 20,
});
