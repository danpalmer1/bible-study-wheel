const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const raw = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(raw);

function ok(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    },
    body: JSON.stringify(body),
  };
}

function err(message, status = 400) {
  return ok({ error: message }, status);
}

function getClaims(event) {
  return event?.requestContext?.authorizer?.claims ?? {};
}

function getGroups(event) {
  const groups = getClaims(event)['cognito:groups'];
  if (!groups) return [];
  return Array.isArray(groups) ? groups : String(groups).split(',');
}

function isAdmin(event) {
  return getGroups(event).includes('admin');
}

function userId(event) {
  return getClaims(event).sub;
}

module.exports = { doc, ok, err, getClaims, getGroups, isAdmin, userId };
