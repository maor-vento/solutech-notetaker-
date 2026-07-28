// Watches every non-terminal bot: updates its status, and when Recall marks it
// done, downloads the transcript, formats it, and emails it. Polling (instead
// of relying only on webhooks) means the app works locally with no public URL.
const config = require('./config');
const store = require('./store');
const recall = require('./recall');
const { formatTranscript } = require('./transcript');
const { sendEmail, transcriptEmailHtml } = require('./email');

const POLL_MS = 15_000;
const TERMINAL = new Set(['emailed', 'intel_sent', 'failed', 'no_transcript']);
const INTEL_MAX_ATTEMPTS = 3;

// Hand the transcript to the time-tracking app's notetaker-intel function,
// which extracts work items, pings owners on Slack, and emails the requester.
async function sendToIntel(meeting, formatted, title, dateLabel) {
  const res = await fetch(config.intel.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: config.intel.secret,
      meeting_title: title,
      meeting_date: meeting.createdAt,
      date_label: dateLabel,
      participants: formatted.participants,
      requester_email: meeting.requestedBy || config.resend.to,
      transcript: formatted.text,
      transcript_html: formatted.html,
    }),
  });
  if (!res.ok) throw new Error(`intel webhook failed (${res.status})`);
}

async function processMeeting(meeting) {
  const bot = await recall.getBot(meeting.botId);
  const status = recall.latestStatus(bot);

  if (status === 'fatal') {
    const changes = bot.status_changes || [];
    const last = changes[changes.length - 1] || {};
    store.updateMeeting(meeting.botId, {
      status: 'failed',
      error: last.sub_code || last.message || 'Bot failed to join or record the call',
    });
    return;
  }

  if (status !== 'done') {
    if (status !== meeting.status) store.updateMeeting(meeting.botId, { status });
    return;
  }

  // Call finished and Recall finished processing — get the transcript out.
  store.updateMeeting(meeting.botId, { status: 'processing_transcript' });
  const segments = await recall.fetchTranscript(bot);
  const formatted = formatTranscript(segments || []);

  if (formatted.empty) {
    store.updateMeeting(meeting.botId, {
      status: 'no_transcript',
      error:
        'Call ended but no transcript was produced. If this was a Zoom call with the ' +
        '"meeting_captions" provider, the host may not have had closed captions enabled.',
    });
    return;
  }

  const title = meeting.title || `${meeting.platform === 'zoom' ? 'Zoom' : 'Google Meet'} call`;
  const dateLabel = new Date(meeting.createdAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Preferred path: the time-tracking app's intel pipeline handles everything
  // (summary + work items + Slack + email). Direct email is the fallback.
  if (config.intelConfigured() && (meeting.intelAttempts || 0) < INTEL_MAX_ATTEMPTS) {
    try {
      await sendToIntel(meeting, formatted, title, dateLabel);
      store.updateMeeting(meeting.botId, { status: 'intel_sent', emailedAt: new Date().toISOString(), error: null });
      console.log(`[poller] transcript sent to intel pipeline for bot ${meeting.botId}`);
      return;
    } catch (err) {
      const attempts = (meeting.intelAttempts || 0) + 1;
      store.updateMeeting(meeting.botId, { intelAttempts: attempts, error: err.message });
      console.error(`[poller] intel attempt ${attempts}/${INTEL_MAX_ATTEMPTS} for bot ${meeting.botId}: ${err.message}`);
      if (attempts < INTEL_MAX_ATTEMPTS) return; // retry on the next tick
      console.error(`[poller] intel pipeline unreachable — falling back to direct email`);
    }
  }

  await sendEmail({
    to: meeting.requestedBy,
    subject: `Transcript: ${title} — ${dateLabel}`,
    html: transcriptEmailHtml({
      title,
      dateLabel,
      durationLabel: formatted.durationLabel,
      participants: formatted.participants,
      transcriptHtml: formatted.html,
    }),
    textAttachment: {
      filename: `transcript-${meeting.botId.slice(0, 8)}.txt`,
      content: `${title}\n${dateLabel}\nParticipants: ${formatted.participants.join(', ')}\n\n${formatted.text}`,
    },
  });

  store.updateMeeting(meeting.botId, { status: 'emailed', emailedAt: new Date().toISOString() });
  console.log(`[poller] transcript emailed for bot ${meeting.botId}`);
}

async function tick() {
  const active = store.listMeetings().filter((m) => !TERMINAL.has(m.status));
  for (const meeting of active) {
    try {
      await processMeeting(meeting);
    } catch (err) {
      console.error(`[poller] bot ${meeting.botId}: ${err.message}`);
      // Transient errors (network, Recall still processing) get retried on the
      // next tick; only email failures after a done bot would loop, so surface
      // the error on the meeting without marking it terminal.
      store.updateMeeting(meeting.botId, { error: err.message });
    }
  }
}

function start() {
  setInterval(tick, POLL_MS);
  tick().catch(() => {});
  console.log(`[poller] watching bots every ${POLL_MS / 1000}s`);
}

module.exports = { start };
