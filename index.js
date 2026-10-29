require('dotenv').config();

// Fetch every page of data points for one Health API data type.
async function getAllDataPoints(
  dataType,
  accessToken,
  initialDataPoints = [],
  initialPageToken,
  filter,
  dataSourceFamily,
) {
  const dataPoints = [...initialDataPoints];

  // Google returns a token when more pages exist. An empty value means that the first request should be made without a pageToken.
  let pageToken = initialPageToken;

  // A do-while loop is appropriate because at least one API request is
  // required, even when there is no token from an earlier request.
  do {
    // URL handles escaping and query-string formatting. This is safer than
    // manually concatenating strings with '?' and '&'.
    const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints`,);
    if (pageToken) {
      // The token tells Google which page to return next.
      url.searchParams.set('pageToken', pageToken);
    }
    if (filter) {
      url.searchParams.set('filter', filter);
    }
    if (dataSourceFamily) {
      url.searchParams.set('dataSourceFamily', dataSourceFamily);
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${dataType} request failed (${response.status}): ${errorText}`);
    }

    // response.json() parses the HTTP response into a JavaScript object.
    const data = await response.json();

    // The ... spread appends all elements from this page, like
    // std::vector::insert(dataPoints.end(), page.begin(), page.end()).
    dataPoints.push(...(data.dataPoints || []));

    // If Google supplies another token, the loop requests the next page.
    // If it supplies no token, this becomes undefined and the loop stops.
    pageToken = data.nextPageToken;
  } while (pageToken);

  return dataPoints;
}

// "async" marks this function as one that performs work that may finish later.
// "await" below pauses this function until a network request finishes.
async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://www.google.com';
  const authorizationCode = process.env.GOOGLE_AUTHORIZATION_CODE;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const stepGoal = Number(process.env.GOOGLE_STEP_GOAL || 10000);

  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this script.',);
  }

  const scope =
    'https://www.googleapis.com/auth/googlehealth.sleep.readonly ' +
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';

  // The first run does not have a refresh token, so create a URL that asks
  // the user to approve access to Google Health.
  if (!refreshToken) {
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth',);

    // URLSearchParams converts these named fields into the query string
    // after the '?' in the URL. This is similar to building a map of
    // key/value pairs and serializing it before sending it to a server.
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scope,
    }).toString();

    // console.log prints text to the terminal, similar to std::cout.
    console.log('Open this URL to authorize the application:');
    console.log(authorizationUrl.toString());
  }

  // On the first run, Google gives the user an authorization code.
  // The user must put that code in the environment before running again.
  // On later runs, the saved refresh token is enough.
  if (!refreshToken && !authorizationCode) {
    console.log('After authorizing, set GOOGLE_AUTHORIZATION_CODE to the code from the redirect URL and run the script again.',);
    return;
  }

  let tokenParameters;

  // If a refresh token exists, ask Google to exchange it for a short-lived
  // access token. This is the normal path after the first run.
  if (refreshToken) {
    tokenParameters = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };
  } else {
    // Otherwise, exchange the one-time authorization code for tokens.
    tokenParameters = {
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
  }

  // fetch sends an HTTP request and returns a Response object.
  // This POST request sends the credentials to Google's token endpoint.
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded',},

    // Google expects the object to be encoded as form data.
    body: new URLSearchParams(tokenParameters),
  });

  // response.ok is true for a successful HTTP status (200-299).
  // If the request failed, read Google's error text and stop.
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token request failed (${tokenResponse.status}): ${errorText}`);
  }

  // json() reads the response body and converts JSON text into a JavaScript
  // object. This is similar to deserializing a JSON string into a struct.
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // The access token is required for every later Health API request.
  if (!accessToken) {
    throw new Error('Google did not return an access token.');
  }

  if (!refreshToken && tokenData.refresh_token) {
    // Google only returns a refresh token during the first authorization.
    // Print it so it can be saved in the local .env file.
    console.log('Set GOOGLE_REFRESH_TOKEN to this value for future runs:', tokenData.refresh_token,);
  }

  // Send the access token in the HTTP Authorization header.
  // "Bearer" tells Google that the value is a temporary access token.
  // This request asks for all sleep data points available to this account.
  const sleepResponse = await fetch( 'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints',
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!sleepResponse.ok) {
    const errorText = await sleepResponse.text();
    throw new Error(`Sleep request failed (${sleepResponse.status}): ${errorText}`);
  }

  await sleepResponse.text();
  // Measure the night's rest from 9 PM yesterday through 9 PM today.
  const sleepWindowEnd = new Date();
  sleepWindowEnd.setHours(21, 0, 0, 0);
  const sleepWindowStart = new Date(sleepWindowEnd);
  sleepWindowStart.setDate(sleepWindowStart.getDate() - 1);

  // The API filter reduces the response to the target night. The helper
  // still follows every page, so no matching sleep records are omitted.
  const sleepPoints = await getAllDataPoints(
    'sleep',
    accessToken,
    [],
    undefined,
    `sleep.interval.end_time >= "${sleepWindowStart.toISOString()}" AND sleep.interval.end_time < "${sleepWindowEnd.toISOString()}"`,
  );

  let sleepTime = 0;
  for (const point of sleepPoints) {
    const interval = point.sleep?.interval;
    if (!interval) {
      continue;
    }

    const stages = point.sleep?.stages || [];
    const intervals = stages.length ? stages : [interval];
    for (const sleepInterval of intervals) {
      if (sleepInterval.type === 'AWAKE') {
        continue;
      }

      const startTime = Date.parse(sleepInterval.startTime);
      const endTime = Date.parse(sleepInterval.endTime);
      if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        continue;
      }

      // Clip intervals that cross either 9 PM boundary to avoid counting
      // sleep outside the requested night.
      const clippedStart = Math.max(startTime, sleepWindowStart.getTime());
      const clippedEnd = Math.min(endTime, sleepWindowEnd.getTime());
      if (clippedEnd > clippedStart) {
        sleepTime += clippedEnd - clippedStart;
      }
    }
  }

  const totalSleepMinutes = Math.round(sleepTime / 1000 / 60);
  const sleepHours = `${Math.floor(totalSleepMinutes / 60)}h ${totalSleepMinutes % 60}min`;

  // Create a Date object representing the current moment.
  // setHours changes it to local midnight, the beginning of today.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Ask Google for step data points using the same access token.
  const stepsResponse = await fetch( 'https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints',
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!stepsResponse.ok) {
    const errorText = await stepsResponse.text();
    throw new Error(`Steps request failed (${stepsResponse.status}): ${errorText}`);
  }

  // Convert the response to an object and prepare an empty total.
  await stepsResponse.text();
  let dailySteps = 0;

  // Use only wearable records so phone and wearable measurements are not
  // counted twice. The helper also retrieves every page for today's range.
  const stepPoints = await getAllDataPoints(
    'steps',
    accessToken,
    [],
    undefined,
    `steps.interval.start_time >= "${startOfDay.toISOString()}" AND steps.interval.start_time < "${endOfDay.toISOString()}"`,
    'users/me/dataSourceFamilies/google-wearables',
  );

  // Examine every step data point returned by Google.
  for (const point of stepPoints) {
    const interval = point.steps?.interval;
    if (!interval) {
      continue;
    }

    const startTime = Date.parse(interval.startTime);
    const endTime = Date.parse(interval.endTime);

    // Date.parse returns NaN when a date is invalid.
    // Number.isNaN is the JavaScript equivalent of checking for NaN.
    // Ignore records whose timestamps cannot be understood.
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      continue;
    }

    // Include only intervals contained within today's local calendar day.
    if (startTime < startOfDay.getTime() || endTime >= endOfDay.getTime()) {
      continue;
    }

    // The Health API returns the step count as a string on the steps object.
    dailySteps += Number(point.steps.count) || 0;
  }

  // An object passed to console.log prints named results.
  // The field: value syntax is similar to assigning fields in a C++ struct.
  console.log({
    dailySteps: dailySteps,
    stepGoal: stepGoal,
    sleepHours: sleepHours,
  });
}

// Calling an async function returns a Promise, which represents work that
// may finish later. catch() handles an error thrown anywhere in main().
// process.exitCode = 1 tells the shell that the program failed.
main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
