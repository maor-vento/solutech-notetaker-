require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3999', 10),
  botName: process.env.BOT_NAME || 'Solutech Notetaker',

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
};

config.recall.baseUrl = `https://${config.recall.region}.recall.ai`;
config.recallConfigured = () => Boolean(config.recall.apiKey);
config.resendConfigured = () => Boolean(config.resend.apiKey);
config.googleConfigured = () => Boolean(config.google.clientId && config.google.clientSecret);

module.exports = config;
