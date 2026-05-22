const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok, err } = require('../shared/helpers');

const ATTENDEES_TABLE = process.env.ATTENDEES_TABLE;
const MEETINGS_TABLE = process.env.MEETINGS_TABLE;
const SPINS_TABLE = process.env.SPINS_TABLE;

exports.handler = async () => {
  try {
    const [attendeesRes, meetingsRes, spinsRes] = await Promise.all([
      doc.send(new ScanCommand({ TableName: ATTENDEES_TABLE })),
      doc.send(new ScanCommand({ TableName: MEETINGS_TABLE })),
      doc.send(new ScanCommand({ TableName: SPINS_TABLE })),
    ]);
    const attendees = attendeesRes.Items ?? [];
    const meetings = meetingsRes.Items ?? [];
    const spins = spinsRes.Items ?? [];

    const lastSpin =
      spins.length === 0
        ? null
        : [...spins].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];

    const result = attendees.map((a) => ({
      attendeeId: a.attendeeId,
      name: a.name,
      active: a.active,
      meetingsAttended: meetings.filter((m) => (m.attendeeIds ?? []).includes(a.attendeeId)).length,
      timesEligible: spins.filter((s) => (s.eligibleAttendeeIds ?? []).includes(a.attendeeId)).length,
      timesSelected: spins.filter((s) => s.selectedAttendeeId === a.attendeeId).length,
      isLastSelected: lastSpin?.selectedAttendeeId === a.attendeeId,
    }));

    return ok({ attendees: result, lastSpin });
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
