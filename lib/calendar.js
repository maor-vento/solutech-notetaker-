// Google Calendar auto-join (optional). Once GOOGLE_CLIENT_ID/SECRET are set
// and the user authorizes via /api/google/auth-url, this syncs every 5 minutes:
// it finds upcoming events with a Meet/Zoom link and schedules a Recall bot to
// join each one shortly before it starts. Uses raw OAuth + REST — no SDK.
const config = require('./config');
const store = require('./store');
const recall = require('./recall');

const SYNC_MS = 5 * 60_000;
const LOOKAHEAD_MS = 24 * 60 * 60_000;

function redirectUri() {
  return `http://localhost:${config.port}/oauth2callback`;
}

function isConnected() {
  return config.googleConfigured() && Boolean(store.getGoogleToken()?.refresh_token);
}

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token request failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function handleCallback(code) {
  const token = await tokenRequest({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });
  store.setGoogleToken(token);
}

async function accessToken() {
  const saved = store.getGoogleToken();
  if (!saved?.refresh_token) throw new Error('Google Calendar not connected');
  const token = await tokenRequest({
    refresh_token: saved.refresh_token,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    grant_type: 'refresh_token',
  });
  return token.access_token;
}

function extractMeetingUrl(event) {
  const video = (event.conferenceData?.entryPoints || []).find((e) => e.entryPointType === 'video');
  if (video?.uri) return video.uri;
  if (event.hangoutLink) return event.hangoutLink;
  const haystack = `${event.location || ''} ${event.description || ''}`;
  const match = haystack.match(
    /https:\/\/(?:[\w-]+\.)?(?:zoom\.us\/j\/[^\s<>"']+|meet\.google\.com\/[a-z-]+)/i
  );
  return match ? match[0] : null;
}

async function sync() {
  if (!isConnected()) return;
  const token = await accessToken();
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + LOOKAHEAD_MS).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Calendar list failed (${res.status})`);
  const { items = [] } = await res.json();

  for (const event of items) {
    if (!event.start?.dateTime) continue; // skip all-day events
    if (store.hasCalendarEvent(event.id)) continue;
    const url = extractMeetingUrl(event);
    if (!url) continue;

    const start = new Date(event.start.dateTime);
    const joinAt = new Date(start.getTime() - config.google.joinOffsetMin * 60_000);
    const bot = await recall.createBot(url, {
      joinAt: (joinAt > now ? joinAt : now).toISOString(),
    });

    store.addCalendarEvent(event.id, { botId: bot.id, start: event.start.dateTime, summary: event.summary });
    store.addMeeting({
      botId: bot.id,
      url,
      platform: recall.detectPlatform(url),
      title: event.summary || 'Calendar meeting',
      source: 'calendar',
      requestedBy: config.resend.to, // calendar bots belong to the account owner

      status: 'scheduled',
      joinAt: joinAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
    console.log(`[calendar] scheduled bot for "${event.summary}" at ${joinAt.toISOString()}`);
  }
}

function start() {
  if (!config.googleConfigured()) {
    console.log('[calendar] auto-join disabled (no Google OAuth credentials in .env)');
    return;
  }
  setInterval(() => sync().catch((e) => console.error(`[calendar] ${e.message}`)), SYNC_MS);
  sync().catch((e) => console.error(`[calendar] ${e.message}`));
  console.log('[calendar] auto-join enabled — syncing every 5 min');
}

module.exports = { start, getAuthUrl, handleCallback, isConnected };
