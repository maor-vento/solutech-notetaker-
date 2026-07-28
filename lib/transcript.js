// Turn Recall's transcript JSON (array of { participant, words[] }) into
// speaker-labelled plain text and HTML. Shapes vary slightly by provider,
// so all field access is defensive.

function wordText(w) {
  return (w && (w.text ?? w.word)) || '';
}

function wordStart(w) {
  const ts = w && w.start_timestamp;
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts.relative === 'number') return ts.relative;
  return null;
}

function fmtClock(seconds) {
  if (seconds == null) return '';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// -> { text, html, participants, durationLabel, empty }
function formatTranscript(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { text: '', html: '', participants: [], durationLabel: '', empty: true };
  }

  // Merge consecutive segments from the same speaker into one block.
  const blocks = [];
  for (const seg of segments) {
    const name = seg?.participant?.name || 'Unknown speaker';
    const words = Array.isArray(seg?.words) ? seg.words : [];
    const text = words.map(wordText).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = words.length ? wordStart(words[0]) : null;
    const last = blocks[blocks.length - 1];
    if (last && last.name === name) {
      last.text += ' ' + text;
    } else {
      blocks.push({ name, start, text });
    }
  }

  const participants = [...new Set(blocks.map((b) => b.name))];
  let lastStart = null;
  for (const b of blocks) if (b.start != null) lastStart = b.start;
  const durationLabel = lastStart != null ? `~${Math.max(1, Math.round(lastStart / 60))} min` : '';

  const text = blocks
    .map((b) => `[${fmtClock(b.start)}] ${b.name}:\n${b.text}\n`)
    .join('\n');

  const html = blocks
    .map(
      (b) => `
      <div style="margin:0 0 14px 0;">
        <div style="font-weight:600;color:#111827;font-size:14px;">
          ${escapeHtml(b.name)}
          <span style="font-weight:400;color:#9ca3af;font-size:12px;margin-left:6px;">${fmtClock(b.start)}</span>
        </div>
        <div style="color:#374151;font-size:14px;line-height:1.55;">${escapeHtml(b.text)}</div>
      </div>`
    )
    .join('');

  return { text, html, participants, durationLabel, empty: blocks.length === 0 };
}

module.exports = { formatTranscript };
