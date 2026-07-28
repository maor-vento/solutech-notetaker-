// Send transcript emails via Resend (https://resend.com).
const config = require('./config');

async function sendEmail({ subject, html, textAttachment }) {
  if (!config.resendConfigured()) throw new Error('RESEND_API_KEY is not set — add it to .env');

  const payload = {
    from: config.resend.from,
    to: [config.resend.to],
    subject,
    html,
  };
  if (textAttachment) {
    payload.attachments = [
      {
        filename: textAttachment.filename,
        content: Buffer.from(textAttachment.content, 'utf8').toString('base64'),
      },
    ];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}

function transcriptEmailHtml({ title, dateLabel, durationLabel, participants, transcriptHtml }) {
  const meta = [dateLabel, durationLabel, participants.length ? `${participants.length} speakers` : '']
    .filter(Boolean)
    .join(' · ');
  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
    <div style="border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;font-weight:700;">Solutech Notetaker</div>
      <h1 style="font-size:20px;color:#111827;margin:6px 0 4px 0;">${title}</h1>
      <div style="font-size:13px;color:#6b7280;">${meta}</div>
    </div>
    ${participants.length ? `<div style="font-size:13px;color:#6b7280;margin-bottom:18px;"><strong style="color:#374151;">Participants:</strong> ${participants.join(', ')}</div>` : ''}
    ${transcriptHtml}
    <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:12px;font-size:12px;color:#9ca3af;">
      Full transcript attached as .txt · Sent automatically by Solutech Notetaker
    </div>
  </div>`;
}

module.exports = { sendEmail, transcriptEmailHtml };
