const { randomUUID } = require('crypto');
const {
  ScanCommand,
  PutCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { doc, ok, err, isAdmin, userId } = require('../shared/helpers');

const TABLE = process.env.MEETINGS_TABLE;
const ATTENDEES_TABLE = process.env.ATTENDEES_TABLE;
const VALID_TYPES = ['fourTs', 'reading', 'presentation'];

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id = event.pathParameters?.id;
  if (!isAdmin(event)) return err('Admin only', 403);
  try {
    if (method === 'GET') {
      const out = await doc.send(new ScanCommand({ TableName: TABLE }));
      const items = out.Items ?? [];
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return ok(items);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { date, attendeeIds, topicType, book, chapter, topicText } = body;
      if (!date) return err('date required');
      if (topicType !== undefined && topicType !== null && !VALID_TYPES.includes(topicType)) {
        return err('Invalid topicType');
      }
      if (attendeeIds !== undefined) {
        if (!Array.isArray(attendeeIds)) return err('attendeeIds must be array');
        const known = await doc.send(
          new ScanCommand({ TableName: ATTENDEES_TABLE, ProjectionExpression: 'attendeeId' })
        );
        const ids = new Set((known.Items ?? []).map((a) => a.attendeeId));
        if (!attendeeIds.every((i) => ids.has(i))) return err('Unknown attendee id');
      }

      const existing = await doc.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: '#date = :d',
          ExpressionAttributeNames: { '#date': 'date' },
          ExpressionAttributeValues: { ':d': String(date) },
        })
      );
      let meeting = (existing.Items ?? [])[0];
      if (!meeting) {
        meeting = {
          meetingId: randomUUID(),
          date: String(date),
          attendeeIds: [],
          topicType: null,
          book: null,
          chapter: null,
          topicText: null,
          createdBy: userId(event) || 'unknown',
          createdAt: new Date().toISOString(),
        };
      }
      if (attendeeIds !== undefined) meeting.attendeeIds = attendeeIds;
      if (topicType !== undefined) {
        meeting.topicType = topicType || null;
        meeting.book = null;
        meeting.chapter = null;
        meeting.topicText = null;
        if (topicType === 'reading') {
          if (typeof book !== 'string' || !book) return err('reading requires book');
          if (typeof chapter !== 'number' || chapter < 1) return err('reading requires chapter');
          meeting.book = book;
          meeting.chapter = chapter;
        } else if (topicType === 'presentation') {
          meeting.topicText = typeof topicText === 'string' ? topicText : '';
        }
      }
      await doc.send(new PutCommand({ TableName: TABLE, Item: meeting }));
      return ok(meeting, 201);
    }
    if (method === 'DELETE' && id) {
      await doc.send(new DeleteCommand({ TableName: TABLE, Key: { meetingId: id } }));
      return ok({ ok: true });
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
