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

## Branding

- **Portal logo** — drop your logo at `public/logo.png` and the page header
  picks it up automatically (no config needed). Any PNG with a transparent
  background looks best on the dark theme.
- **In-call avatar** — drop a **16:9 JPEG** (1280x720 recommended) at
  `public/bot-avatar.jpg` and the bot broadcasts it as its camera while in the
  call, instead of showing a blank tile. Override the path with `BOT_AVATAR`
  in `.env`. Restart the server after adding either file.

## Transcription notes

- Default provider is `meeting_captions` — the platform's own captions, at no
  extra transcription cost. On **Google Meet** the bot turns captions on itself.
  On **Zoom** the host must have closed captions enabled in their settings;
  if a Zoom call produces no transcript, that's the first thing to check.
- For higher-quality AI transcription (and Zoom without captions), switch
  `RECALL_TRANSCRIPT_PROVIDER` to one of Recall's AI providers (e.g.
  `assembly_ai_async`) — billed per hour through Recall.

## Team login

The portal requires sign-in with a Solutech Google account, using the **same
Supabase project as the time-tracking app** (defaults baked into
`lib/config.js`). Each teammate's transcripts go to *their own* inbox.
One-time setup: add the notetaker's URL(s) — `http://localhost:3999` and the
deployed URL — under Supabase → Authentication → URL Configuration →
Redirect URLs. `AUTH_DISABLED=true` turns the gate off for local hacking.

## Work AI intel pipeline

With `INTEL_WEBHOOK_URL` + `INTEL_SECRET` set, finished transcripts are POSTed
to the time-tracking app's `notetaker-intel-background` Netlify function
instead of being emailed directly. That function (see the solutech-time-tracking
repo) summarizes the call, extracts work items into the **Work AI tab**
(same dedup keys as the nightly digest), **Slack-DMs each item's owner
immediately**, and emails the requester a summary + full transcript.
If the webhook is unreachable after 3 attempts, the notetaker falls back to
its own plain transcript email, so nothing is ever lost.

Netlify needs these env vars for the function: `NOTETAKER_SECRET` (same value
as `INTEL_SECRET` here), `RESEND_API_KEY`, optionally `NOTETAKER_EMAIL_FROM`.
It reuses the existing `SUPABASE_SERVICE_ROLE`, `ANTHROPIC_API_KEY`,
`SLACK_BOT_TOKEN`, and `SLACK_SIGNING_SECRET`.

## Deploying (Render — so the team can use it and calendar auto-join works 24/7)

The app is a single small Node server with a JSON file for state — it runs
anywhere Node 18+ runs. On Render: New → Web Service → connect the GitHub
repo → build `npm install`, start `npm start`, then set the env vars from
`.env` (Render provides `PORT` automatically). Afterwards add the Render URL
to Supabase's auth redirect URLs, and update the Google OAuth redirect URI to
the deployed hostname if calendar auto-join is used. Note: the free tier
sleeps on idle, which breaks mid-call polling — use the $7/mo Starter tier.

## Costs

- Recall.ai: pay-as-you-go per meeting-hour of bot time (roughly $0.7–1/hr).
- Resend: free tier (100 emails/day) is plenty.
- Everything else: free.
