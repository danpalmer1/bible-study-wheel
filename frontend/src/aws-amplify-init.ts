// Configures AWS Amplify when VITE_USE_AMPLIFY=true.
//
// Config values come from env vars (.env.production etc.), not from the
// auto-generated aws-exports.js — that file is gitignored and absent on fresh
// clones, which broke Rollup's static dynamic-import analysis. Copy the values
// from aws-exports.js into your .env after running `amplify push`.
export async function initAmplifyIfNeeded(): Promise<void> {
  if (import.meta.env.VITE_USE_AMPLIFY !== 'true') return;

  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
  const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string | undefined;
  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      '[amplify] VITE_USE_AMPLIFY=true requires VITE_COGNITO_USER_POOL_ID and ' +
        'VITE_COGNITO_USER_POOL_CLIENT_ID. Copy them out of aws-exports.js ' +
        '(aws_user_pools_id and aws_user_pools_web_client_id) into .env.production.'
    );
  }

  const { Amplify } = await import('aws-amplify');
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
}
