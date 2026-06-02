const { randomUUID } = require('crypto');
const { ScanCommand, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok, err, isAdmin } = require('../shared/helpers');

const TABLE = process.env.ATTENDEES_TABLE;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id = event.pathParameters?.id;

  try {
    if (method === 'GET' && !id) {
      const out = await doc.send(new ScanCommand({ TableName: TABLE }));
      return ok(out.Items ?? []);
    }
    if (method === 'POST') {
      if (!isAdmin(event)) return err('Admin only', 403);
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !String(body.name).trim()) return err('name required');
      const attendee = {
        attendeeId: randomUUID(),
        name: String(body.name).trim(),
        active: true,
        createdAt: new Date().toISOString(),
      };
      await doc.send(new PutCommand({ TableName: TABLE, Item: attendee }));
      return ok(attendee, 201);
    }
    if (method === 'PUT' && id) {
      if (!isAdmin(event)) return err('Admin only', 403);
      const body = JSON.parse(event.body || '{}');
      const existing = await doc.send(new GetCommand({ TableName: TABLE, Key: { attendeeId: id } }));
      if (!existing.Item) return err('Not found', 404);
      const updates = [];
      const values = {};
      const names = {};
      if (typeof body.name === 'string' && body.name.trim()) {
        updates.push('#n = :n');
        names['#n'] = 'name';
        values[':n'] = body.name.trim();
      }
      if (typeof body.active === 'boolean') {
        updates.push('active = :a');
        values[':a'] = body.active;
      }
      if (updates.length === 0) return ok(existing.Item);
      const result = await doc.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { attendeeId: id },
          UpdateExpression: 'SET ' + updates.join(', '),
          ExpressionAttributeValues: values,
          ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
          ReturnValues: 'ALL_NEW',
        })
      );
      return ok(result.Attributes);
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
