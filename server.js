const express = require('express');
const path = require('path');
const config = require('./lib/config');
const store = require('./lib/store');
const recall = require('./lib/recall');
const poller = require('./lib/poller');
const calendar = require('./lib/calendar');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    recallConfigured: config.recallConfigured(),
    resendConfigured: config.resendConfigured(),
    googleConfigured: config.googleConfigured(),
    calendarConnected: calendar.isConnected(),
    emailTo: config.resend.to,
    botName: config.botName,
  });
});

app.get('/api/meetings', (req, res) => {
  res.json(store.listMeetings());
});

app.post('/api/meetings', async (req, res) => {
  try {
    const url = String(req.body?.meeting_url || '').trim();
    if (!/^https:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Paste a full https:// meeting link' });
    }
    const platform = recall.detectPlatform(url);
    if (platform === 'unknown') {
      return res.status(400).json({ error: 'Only Google Meet and Zoom links are supported' });
    }
    const bot = await recall.createBot(url);
    const meeting = store.addMeeting({
      botId: bot.id,
      url,
      platform,
      title: req.body?.title?.trim() || null,
      source: 'manual',
      status: 'joining_call',
      createdAt: new Date().toISOString(),
    });
    res.json(meeting);
  } catch (err) {
    console.error(`[api] create bot failed: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// Optional Recall webhooks (poller is the primary mechanism; this just makes
// status updates instant when the server has a public URL).
app.post('/webhook/recall', (req, res) => {
  try {
    const event = req.body || {};
    const botId = event?.data?.bot?.id || event?.data?.bot_id;
    const code = event?.data?.data?.code || event?.data?.status?.code;
    if (botId && code) store.updateMeeting(botId, { status: code });
  } catch { /* never fail a webhook */ }
  res.sendStatus(200);
});

// --- Google Calendar OAuth ---
app.get('/api/google/auth-url', (req, res) => {
  if (!config.googleConfigured()) {
    return res.status(400).json({ error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first' });
  }
  res.json({ url: calendar.getAuthUrl() });
});

app.get('/oauth2callback', async (req, res) => {
  try {
    await calendar.handleCallback(String(req.query.code || ''));
    calendar.start();
    res.send('<p style="font-family:sans-serif">Google Calendar connected — you can close this tab.</p>');
  } catch (err) {
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

app.listen(config.port, () => {
  console.log(`Solutech Notetaker running at http://localhost:${config.port}`);
  console.log(`Recall: ${config.recallConfigured() ? 'configured' : 'MISSING KEY'} (${config.recall.region}) | Resend: ${config.resendConfigured() ? 'configured' : 'MISSING KEY'} -> ${config.resend.to}`);
  poller.start();
  calendar.start();
});
