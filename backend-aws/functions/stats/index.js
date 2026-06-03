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

    // 1-meeting cooldown: whoever was picked at a meeting sits out the *next*
    // meeting's wheel. Map each meeting to the previous meeting's pick so we can
    // tell, per meeting, who was present-but-not-eligible.
    const chronological = [...meetings].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
    const prevPickByMeetingId = new Map();
    chronological.forEach((m, i) => {
      prevPickByMeetingId.set(m.meetingId, i > 0 ? chronological[i - 1].selectedAttendeeId ?? null : null);
    });

    const result = attendees.map((a) => {
      const attended = meetings.filter((m) =>
        (m.attendeeIds ?? []).includes(a.attendeeId)
      );
      const meetingsAttended = attended.length;
      // On the wheel that meeting unless they were the previous meeting's pick.
      const timesEligible = attended.filter(
        (m) => prevPickByMeetingId.get(m.meetingId) !== a.attendeeId
      ).length;
      const timesSelected = meetingsWithPick.filter(
        (m) => m.selectedAttendeeId === a.attendeeId
      ).length;
      return {
        attendeeId: a.attendeeId,
        name: a.name,
        active: a.active,
        meetingsAttended,
        timesEligible,
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
