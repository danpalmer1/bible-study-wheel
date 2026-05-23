const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminConfirmSignUpCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { ok, err, isAdmin } = require('../shared/helpers');

const USER_POOL_ID = process.env.USER_POOL_ID;
const cognito = new CognitoIdentityProviderClient({});

function attr(u, name) {
  return u.Attributes?.find((a) => a.Name === name)?.Value;
}

function displayName(u) {
  // Prefer given_name + family_name (new signups), fall back to `name`.
  const given = attr(u, 'given_name');
  const family = attr(u, 'family_name');
  const composed = [given, family].filter((v) => v && v.trim()).join(' ').trim();
  return composed || attr(u, 'name') || '';
}

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
        email: attr(u, 'email'),
        name: displayName(u),
        createdAt: u.UserCreateDate?.toISOString(),
      }));
      return ok(users);
    }
    // GET /users — list approved (CONFIRMED) users with role derived from admin-group membership.
    if (method === 'GET' && (path.endsWith('/users') || path === '/users')) {
      const [allOut, adminOut] = await Promise.all([
        cognito.send(
          new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            Filter: 'cognito:user_status = "CONFIRMED"',
          })
        ),
        cognito.send(
          new ListUsersInGroupCommand({ UserPoolId: USER_POOL_ID, GroupName: 'admin' })
        ),
      ]);
      const adminSet = new Set((adminOut.Users ?? []).map((u) => u.Username));
      const users = (allOut.Users ?? []).map((u) => ({
        userId: u.Username,
        email: attr(u, 'email'),
        name: displayName(u),
        role: adminSet.has(u.Username) ? 'admin' : 'member',
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
    if (method === 'POST' && username && path.endsWith('/promote')) {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          GroupName: 'admin',
        })
      );
      return ok({ ok: true });
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Server error', 500);
  }
};
