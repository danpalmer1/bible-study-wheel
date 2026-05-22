const { randomUUID } = require('crypto');
const { ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok, err, userId } = require('../shared/helpers');

const TABLE = process.env.SPINS_TABLE;
const ATTENDEES_TABLE = process.env.ATTENDEES_TABLE;

exports.handler = async (event) => {
  const path = event.path || event.resource || '';
  const method = event.httpMethod;

  try {
    if (method === 'GET' && path.endsWith('/latest')) {
      const out = await doc.send(new ScanCommand({ TableName: TABLE }));
      const items = out.Items ?? [];
      if (items.length === 0) return ok(null);
      items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      return ok(items[0]);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { selectedAttendeeId, eligibleAttendeeIds } = body;
      if (!selectedAttendeeId || !Array.isArray(eligibleAttendeeIds) || eligibleAttendeeIds.length === 0) {
        return err('selectedAttendeeId and eligibleAttendeeIds required');
      }
      if (!eligibleAttendeeIds.includes(selectedAttendeeId)) {
        return err('Selected attendee must be in eligible list');
      }
      const known = await doc.send(new ScanCommand({ TableName: ATTENDEES_TABLE, ProjectionExpression: 'attendeeId' }));
      const ids = new Set((known.Items ?? []).map((a) => a.attendeeId));
      if (!ids.has(selectedAttendeeId) || !eligibleAttendeeIds.every((i) => ids.has(i))) {
        return err('Unknown attendee id');
      }
      const spin = {
        spinId: randomUUID(),
        timestamp: new Date().toISOString(),
        selectedAttendeeId,
        eligibleAttendeeIds,
        triggeredBy: userId(event) || 'unknown',
      };
      await doc.send(new PutCommand({ TableName: TABLE, Item: spin }));
      return ok(spin, 201);
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
