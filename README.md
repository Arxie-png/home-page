# Home Page

A customizable home-screen-style dashboard that displays fitness information and
provides quick access to frequently used websites.

## Features

- Displays daily steps and sleep data from the Google Health API.
- Provides editable website shortcuts with automatically loaded logos.
- Supports custom accent colors, background colors, and background images.
- Stores shortcut and appearance preferences locally in the browser.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID` and
   `   GOOGLE_CLIENT_SECRET` from your Google Cloud project. Set `APP_PASSWORD` to a
   unique password for the dashboard. Keep `.env` private.

3. Start the web server:

   ```sh
   npm start
   ```

4. Open http://localhost:3000 in your browser.

On the first run, follow the authorization URL printed in the terminal. Add the
authorization code or refresh token to `.env` as instructed by the script, then
restart the server. If Google Health is unavailable, the page displays `No data`.

## Goal

Create a practical, configurable browser homepage that combines fitness data
with useful shortcuts.
