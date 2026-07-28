// Tiny JSON-file persistence. Fine for a single-instance internal tool;
// swap for a real DB if this ever runs multi-instance.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'state.json');

const defaults = {
  meetings: [],        // { botId, url, platform, title, source, status, createdAt, joinAt, emailedAt, error }
  calendarEvents: {},  // eventId -> { botId, start, summary }
  googleToken: null,   // { refresh_token, ... }
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

let state = load();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

module.exports = {
  listMeetings: () => [...state.meetings].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),

  addMeeting(meeting) {
    state.meetings.push(meeting);
    save();
    return meeting;
  },

  getMeeting: (botId) => state.meetings.find((m) => m.botId === botId),

  updateMeeting(botId, patch) {
    const m = state.meetings.find((x) => x.botId === botId);
    if (m) { Object.assign(m, patch); save(); }
    return m;
  },

  hasCalendarEvent: (eventId) => Boolean(state.calendarEvents[eventId]),

  addCalendarEvent(eventId, info) {
    state.calendarEvents[eventId] = info;
    save();
  },

  getGoogleToken: () => state.googleToken,

  setGoogleToken(token) {
    // Google only returns refresh_token on first consent — keep the old one.
    state.googleToken = { ...(state.googleToken || {}), ...token };
    save();
  },
};
