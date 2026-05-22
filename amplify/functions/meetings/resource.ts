import { defineFunction } from '@aws-amplify/backend';

export const meetingsFn = defineFunction({
  name: 'meetings',
  entry: '../../../backend-aws/functions/meetings/index.js',
  runtime: 20,
});
