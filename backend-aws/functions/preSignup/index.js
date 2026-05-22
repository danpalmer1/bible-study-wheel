const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({});
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || ADMIN_EMAIL;

exports.handler = async (event) => {
  if (ADMIN_EMAIL && FROM_EMAIL) {
    const newUser = event.request.userAttributes;
    try {
      await ses.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [ADMIN_EMAIL] },
          Message: {
            Subject: { Data: `Bible Study Wheel: new signup awaiting approval` },
            Body: {
              Text: {
                Data: `${newUser.name || '(no name)'} <${newUser.email}> just signed up.\n\nApprove or reject from the Admin panel of the app.`,
              },
            },
          },
        })
      );
    } catch (e) {
      console.error('SES notify failed (signup still allowed):', e);
    }
  }
  return event;
};
