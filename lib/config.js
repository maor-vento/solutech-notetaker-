require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.PORT || '3999', 10),
  botName: process.env.BOT_NAME || 'Solutech Notetaker',
  // 16:9 JPEG the bot broadcasts as its camera in calls; ignored if the file is absent
  botAvatarPath: process.env.BOT_AVATAR || path.join(__dirname, '..', 'public', 'bot-avatar.jpg'),

  recall: {
    apiKey: process.env.RECALL_API_KEY || '',
    region: process.env.RECALL_REGION || 'us-east-1',
    transcriptProvider: process.env.RECALL_TRANSCRIPT_PROVIDER || 'meeting_captions',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Solutech Notetaker <onboarding@resend.dev>',
    to: process.env.EMAIL_TO || 'maor@solutech.ai',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    joinOffsetMin: parseInt(process.env.CALENDAR_JOIN_OFFSET_MIN || '1', 10),
  },

  // Time-tracking app integration: when set, finished transcripts are POSTed
  // to the notetaker-intel function there (which extracts work items, pings
  // Slack, and emails the requester) instead of being emailed directly.
  intel: {
    url: process.env.INTEL_WEBHOOK_URL || '',
    secret: process.env.INTEL_SECRET || '',
  },

  // Team login — same Supabase project as the time-tracking app, so the whole
  // team signs in with their existing Solutech Google account.
  // Set AUTH_DISABLED=true for keyless local hacking only.
  auth: {
    enabled: process.env.AUTH_DISABLED !== 'true',
    supabaseUrl: process.env.SUPABASE_URL || 'https://ggfxfkohzdttdxcufkwl.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZnhma29oemR0dGR4Y3Vma3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzY4MTgsImV4cCI6MjA5NzAxMjgxOH0._I663I-zQBPIPdas4Ut0CmegradHYwvGCK-bjy2ux3k',
  },
};

config.recall.baseUrl = `https://${config.recall.region}.recall.ai`;
config.recallConfigured = () => Boolean(config.recall.apiKey);
config.resendConfigured = () => Boolean(config.resend.apiKey);
config.googleConfigured = () => Boolean(config.google.clientId && config.google.clientSecret);
config.intelConfigured = () => Boolean(config.intel.url && config.intel.secret);

module.exports = config;
