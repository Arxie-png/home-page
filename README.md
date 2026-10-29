This is a personal project meant to help with learning JavaScript and using Google Cloud APIs.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` from your Google Cloud project. Keep `.env` private.

3. Start the web server:

   ```sh
   npm start
   ```

4. Open http://localhost:3000 in your browser.

On the first run, follow the authorization URL printed in the terminal. Add the
authorization code or refresh token to `.env` as instructed by the script, then
restart the server. If Google Health is unavailable, the page displays `No data`.

## Goal

Show fitness information from a Fitbit Air on a home-screen-style page in the browser.
