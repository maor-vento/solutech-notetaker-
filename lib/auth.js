// Verifies Supabase session tokens (same project as the time-tracking app, so
// the whole team signs in with their existing Solutech Google login). The
// frontend sends the access token as a Bearer header; we verify it against
// Supabase's auth endpoint and attach the user's email to the request.
const config = require('./config');

const cache = new Map(); // token -> { email, expires }

async function verifyToken(token) {
  const hit = cache.get(token);
  if (hit && hit.expires > Date.now()) return hit.email;
  const res = await fetch(`${config.auth.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.auth.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  const email = (user.email || '').toLowerCase();
  if (!email) return null;
  cache.set(token, { email, expires: Date.now() + 5 * 60_000 });
  if (cache.size > 500) cache.clear(); // crude but sufficient bound
  return email;
}

// Express middleware for the API routes.
async function requireUser(req, res, next) {
  if (!config.auth.enabled) {
    req.userEmail = config.resend.to; // local keyless mode: act as the owner
    return next();
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const email = await verifyToken(token);
    if (!email) return res.status(401).json({ error: 'Invalid or expired session' });
    req.userEmail = email;
    next();
  } catch (err) {
    res.status(502).json({ error: 'Could not verify session' });
  }
}

module.exports = { requireUser };
