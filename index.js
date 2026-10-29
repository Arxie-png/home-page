async function main() {
  // Read the Google OAuth settings from the terminal environment.
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://www.google.com';
  const authorizationCode = process.env.GOOGLE_AUTHORIZATION_CODE;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const stepGoal = Number(process.env.GOOGLE_STEP_GOAL || 10000);

  if (!clientId || !clientSecret) {
    throw new Error(
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this script.',
    );
  }

  // Request read-only access to sleep and activity data.
  const scope = [
    'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  ].join(' ');

  // Show the authorization URL only during the one-time setup.
  if (!refreshToken) {
    const authorizationUrl = new URL(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope,
    }).toString();

    console.log(`Open this URL to authorize the application:\n${authorizationUrl}`);
  }

  // Use the refresh token on normal runs, so no new access token is needed manually.
  if (!refreshToken && !authorizationCode) {
    console.log(
      'After authorizing, set GOOGLE_AUTHORIZATION_CODE to the code from the redirect URL and run the script again.',
    );
    return;
  }

  const tokenParameters = refreshToken
    ? {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }
    : {
        code: authorizationCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };

  // Exchange the refresh token, or the one-time authorization code on the first run.
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(tokenParameters),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }

  // Extract the short-lived access token returned by Google.
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error('Google did not return an access token.');
  }

  // Save the refresh token in your environment after the first authorization.
  if (!refreshToken && tokenData.refresh_token) {
    console.log('Set GOOGLE_REFRESH_TOKEN to this value for future runs:', tokenData.refresh_token);
  }

  // Request the user's sleep records from the Health API.
  const sleepResponse = await fetch(
    'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints',
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!sleepResponse.ok) {
    throw new Error(
      `Sleep request failed (${sleepResponse.status}): ${await sleepResponse.text()}`,
    );
  }

  // Convert the API response from JSON into a JavaScript object.
  const sleepData = await sleepResponse.json();
  let sleepTime = 0;

  // Add the duration of every sleep record returned by the API.
  for (const point of sleepData.dataPoints ?? []) {
    sleepTime += Date.parse(point.endTime) - Date.parse(point.startTime);
  }

  // JavaScript returns time differences in milliseconds, so convert them to hours.
  const sleepHours = (sleepTime / 1000 / 60 / 60).toFixed(2);

  // Request today's step records from the Health API.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const stepsUrl = new URL(
    'https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints',
  );

  const stepsResponse = await fetch(stepsUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!stepsResponse.ok) {
    throw new Error(
      `Steps request failed (${stepsResponse.status}): ${await stepsResponse.text()}`,
    );
  }

  // Keep only records from today's local midnight through the current time.
  const stepsData = await stepsResponse.json();
  const now = Date.now();
  const dailySteps = (stepsData.dataPoints ?? []).reduce(
    (total, point) => {
      const start = Date.parse(point.startTime);
      const end = Date.parse(point.endTime);

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < startOfDay.getTime() ||
        end > now
      ) {
        return total;
      }

      return (
        total +
        (point.value ?? []).reduce(
          (pointTotal, value) => pointTotal + (value.intVal ?? 0),
          0,
        )
      );
    },
    0,
  );

  // Print the requested health values.
  console.log({ dailySteps, stepGoal, sleepHours });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
