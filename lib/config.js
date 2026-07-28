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
};

config.recall.baseUrl = `https://${config.recall.region}.recall.ai`;
config.recallConfigured = () => Boolean(config.recall.apiKey);
config.resendConfigured = () => Boolean(config.resend.apiKey);
config.googleConfigured = () => Boolean(config.google.clientId && config.google.clientSecret);

module.exports = config;
