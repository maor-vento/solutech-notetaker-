# Solutech Notetaker

Internal meeting notetaker: a bot joins your Google Meet or Zoom calls, records the
conversation via [Recall.ai](https://recall.ai), and emails the speaker-labelled
transcript to `maor@solutech.ai` when the call ends.

## How it works

```
paste link / calendar event
        │
        ▼
  Recall.ai bot joins the call  ("Solutech Notetaker" — admit it like a guest)
        │  records + captures captions
        ▼
  poller (every 15s) sees the bot finish → downloads transcript JSON
        │  formats with speaker labels + timestamps
        ▼
  Resend emails the transcript (HTML + .txt attachment)
```

## Setup (10 minutes)

1. **Recall.ai** — sign up at <https://recall.ai>, create an API key.
   Note the **region** shown in your dashboard (e.g. `us-east-1`).
2. **Resend** — sign up at <https://resend.com>, create an API key.
   The default sender `onboarding@resend.dev` works immediately; verify the
   `solutech.ai` domain later to send from `notetaker@solutech.ai`.
3. Configure and run:

   ```bash
   cp .env.example .env   # then fill in RECALL_API_KEY, RECALL_REGION, RESEND_API_KEY
   npm install
   npm start
   ```

4. Open <http://localhost:3999>, paste a meeting link, admit the bot when it
   knocks. When the call ends, the transcript lands in your inbox a few minutes
   later.

## Calendar auto-join (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** (type: *Web application*) with redirect URI
   `http://localhost:3999/oauth2callback`, and enable the **Google Calendar API**.
2. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`, restart, and click
   **Connect Google Calendar** in the UI.
3. Every 5 minutes the app scans the next 24h of your primary calendar and
   schedules a bot for every event that has a Meet/Zoom link (joins ~1 minute
   before start; configurable via `CALENDAR_JOIN_OFFSET_MIN`).

## Transcription notes

- Default provider is `meeting_captions` — the platform's own captions, at no
  extra transcription cost. On **Google Meet** the bot turns captions on itself.
  On **Zoom** the host must have closed captions enabled in their settings;
  if a Zoom call produces no transcript, that's the first thing to check.
- For higher-quality AI transcription (and Zoom without captions), switch
  `RECALL_TRANSCRIPT_PROVIDER` to one of Recall's AI providers (e.g.
  `assembly_ai_async`) — billed per hour through Recall.

## Deploying (for calendar auto-join to work while your Mac is closed)

The app is a single small Node server with a JSON file for state — it runs
anywhere Node 18+ runs (Railway, Fly.io, Render, a $5 VPS). Set the same env
vars, and update the Google OAuth redirect URI to the deployed hostname.

## Costs

- Recall.ai: pay-as-you-go per meeting-hour of bot time (roughly $0.7–1/hr).
- Resend: free tier (100 emails/day) is plenty.
- Everything else: free.
