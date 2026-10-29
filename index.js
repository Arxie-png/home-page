async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://www.google.com';
  const authorizationCode = process.env.GOOGLE_AUTHORIZATION_CODE;

  if (!clientId || !clientSecret || !authorizationCode) {
    throw new Error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_AUTHORIZATION_CODE before running this script.');
  }

  const scope ='https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    scope,
  }).toString();

  //console.log(`Open this URL to authorize the application:\n${authorizationUrl}`);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', },
    body: new URLSearchParams({
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }

  const { access_token: accessToken } = await tokenResponse.json();

  const dataResponse = await fetch(
    'https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints',
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!dataResponse.ok) {
    throw new Error(`Health API request failed (${dataResponse.status}): ${await dataResponse.text()}`);
  }

  console.log(JSON.stringify(await dataResponse.json(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
