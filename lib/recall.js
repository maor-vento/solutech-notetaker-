// Minimal Recall.ai API client. Docs: https://docs.recall.ai
const fs = require('fs');
const config = require('./config');

let avatarB64; // undefined = not checked yet, null = no avatar file
function botAvatarB64() {
  if (avatarB64 === undefined) {
    try {
      avatarB64 = fs.readFileSync(config.botAvatarPath).toString('base64');
    } catch {
      avatarB64 = null;
    }
  }
  return avatarB64;
}

async function request(method, apiPath, body) {
  if (!config.recallConfigured()) throw new Error('RECALL_API_KEY is not set — add it to .env');

  const doFetch = (authHeader) =>
    fetch(`${config.recall.baseUrl}${apiPath}`, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  // Recall docs have used both bare-key and "Token <key>" auth over time; try both.
  let res = await doFetch(config.recall.apiKey);
  if (res.status === 401 || res.status === 403) {
    res = await doFetch(`Token ${config.recall.apiKey}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Recall API ${method} ${apiPath} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}

function detectPlatform(url) {
  if (/meet\.google\.com/i.test(url)) return 'google_meet';
  if (/zoom\.us|zoom\.com/i.test(url)) return 'zoom';
  return 'unknown';
}

// Create a bot. joinAt (ISO string) is optional — when set, Recall schedules the join.
async function createBot(meetingUrl, { joinAt } = {}) {
  const payload = {
    meeting_url: meetingUrl,
    bot_name: config.botName,
    recording_config: {
      transcript: {
        provider: { [config.recall.transcriptProvider]: {} },
      },
    },
  };
  const avatar = botAvatarB64();
  if (avatar) {
    payload.automatic_video_output = {
      in_call_recording: { kind: 'jpeg', b64_data: avatar },
      in_call_not_recording: { kind: 'jpeg', b64_data: avatar },
    };
  }
  if (joinAt) payload.join_at = joinAt;
  return request('POST', '/api/v1/bot/', payload);
}

async function getBot(botId) {
  return request('GET', `/api/v1/bot/${botId}/`);
}

// Latest lifecycle status code, e.g. joining_call, in_waiting_room,
// in_call_recording, call_ended, done, fatal.
function latestStatus(bot) {
  const changes = bot.status_changes || [];
  const last = changes[changes.length - 1];
  return last ? last.code : 'unknown';
}

// Pull the transcript JSON for a finished bot, or null if not available.
async function fetchTranscript(bot) {
  const recordings = bot.recordings || [];
  for (const rec of recordings) {
    const url = rec?.media_shortcuts?.transcript?.data?.download_url;
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Transcript download failed (${res.status})`);
      return res.json();
    }
  }
  return null;
}

module.exports = { createBot, getBot, latestStatus, fetchTranscript, detectPlatform };
