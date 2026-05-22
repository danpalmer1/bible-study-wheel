import { defineFunction } from '@aws-amplify/backend';

export const verseFn = defineFunction({
  name: 'verse',
  entry: '../../../backend-aws/functions/verse/index.js',
  runtime: 20,
  // verse handler uses global fetch — Node 20 has it natively.
});
