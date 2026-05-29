const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc, ok, err } = require('../shared/helpers');

const ATTENDEES_TABLE = process.env.ATTENDEES_TABLE;
const MEETINGS_TABLE = process.env.MEETINGS_TABLE;

exports.handler = async () => {
  try {
    const [attendeesRes, meetingsRes] = await Promise.all([
      doc.send(new ScanCommand({ TableName: ATTENDEES_TABLE })),
      doc.send(new ScanCommand({ TableName: MEETINGS_TABLE })),
    ]);
    const attendees = attendeesRes.Items ?? [];
    const meetings = meetingsRes.Items ?? [];

    const meetingsWithPick = meetings.filter((m) => m.selectedAttendeeId);
    const lastPick =
      meetingsWithPick.length === 0
        ? null
        : [...meetingsWithPick].sort((a, b) =>
            String(b.date).localeCompare(String(a.date))
          )[0];

    const result = attendees.map((a) => {
      const meetingsAttended = meetings.filter((m) =>
        (m.attendeeIds ?? []).includes(a.attendeeId)
      ).length;
      const timesSelected = meetingsWithPick.filter(
        (m) => m.selectedAttendeeId === a.attendeeId
      ).length;
      return {
        attendeeId: a.attendeeId,
        name: a.name,
        active: a.active,
        meetingsAttended,
        // Pick rate denominator: every attendee at a meeting is on the wheel,
        // so eligibility collapses to attendance in the new (stateless-wheel) model.
        timesEligible: meetingsAttended,
        timesSelected,
        isLastSelected: lastPick?.selectedAttendeeId === a.attendeeId,
      };
    });

    return ok({
      attendees: result,
      lastPick: lastPick
        ? {
            meetingId: lastPick.meetingId,
            date: lastPick.date,
            selectedAttendeeId: lastPick.selectedAttendeeId,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
