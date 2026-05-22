const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminConfirmSignUpCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { ok, err, isAdmin } = require('../shared/helpers');

const USER_POOL_ID = process.env.USER_POOL_ID;
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  if (!isAdmin(event)) return err('Admin only', 403);
  const path = event.path || event.resource || '';
  const method = event.httpMethod;
  const username = event.pathParameters?.id;

  try {
    if (method === 'GET' && path.endsWith('/pending')) {
      const out = await cognito.send(
        new ListUsersCommand({ UserPoolId: USER_POOL_ID, Filter: 'cognito:user_status = "UNCONFIRMED"' })
      );
      const users = (out.Users ?? []).map((u) => ({
        userId: u.Username,
        email: u.Attributes?.find((a) => a.Name === 'email')?.Value,
        name: u.Attributes?.find((a) => a.Name === 'name')?.Value,
        createdAt: u.UserCreateDate?.toISOString(),
      }));
      return ok(users);
    }
    if (method === 'POST' && username && path.endsWith('/approve')) {
      await cognito.send(new AdminConfirmSignUpCommand({ UserPoolId: USER_POOL_ID, Username: username }));
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          GroupName: 'member',
        })
      );
      return ok({ ok: true });
    }
    if (method === 'POST' && username && path.endsWith('/reject')) {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username }));
      return ok({ ok: true });
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
