import { defineFunction } from '@aws-amplify/backend';

export const attendeesFn = defineFunction({
  name: 'attendees',
  entry: '../../../backend-aws/functions/attendees/index.js',
  runtime: 20,
});
