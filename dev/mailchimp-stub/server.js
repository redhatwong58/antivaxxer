/**
 * Mailchimp local stub — ANTIVAXXER dev only
 *
 * [AV-067] v5.4.8 — Mailchimp doesn't publish an official local mock,
 * so this tiny stub returns canned success responses for the one
 * endpoint api/src/routes/newsletter.js calls:
 *
 *   POST /3.0/lists/:listId/members
 *
 * Real Mailchimp returns 200 with a member object on first subscribe,
 * 400 with title="Member Exists" on resubscribe. This stub mimics
 * that contract by tracking emails in memory.
 *
 * Anything else returns 404. If we add new Mailchimp endpoints in the
 * future, extend this file to match.
 *
 * No dependencies — uses only Node's built-in http module.
 */

const http = require('http');

const PORT = 8081;
const seen = new Set(); // track subscribed emails for "already exists" behavior

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  // Mailchimp list members endpoint
  const memberMatch = req.url.match(/^\/3\.0\/lists\/([^/]+)\/members$/);
  if (memberMatch && req.method === 'POST') {
    const body = await readBody(req);
    const email = body.email_address;

    if (!email) {
      return send(res, 400, { title: 'Invalid Resource', detail: 'Email required' });
    }

    if (seen.has(email)) {
      return send(res, 400, {
        title: 'Member Exists',
        status: 400,
        detail: `${email} is already a list member.`,
      });
    }

    seen.add(email);
    console.log(`[mailchimp-stub] subscribed: ${email}`);
    return send(res, 200, {
      id: 'mock_' + Buffer.from(email).toString('hex').slice(0, 16),
      email_address: email,
      status: body.status || 'subscribed',
      list_id: memberMatch[1],
      _stub: true,
    });
  }

  // Health check
  if (req.url === '/health') return send(res, 200, { ok: true, seen: seen.size });

  send(res, 404, { title: 'Resource Not Found' });
});

server.listen(PORT, () => {
  console.log(`[mailchimp-stub] listening on :${PORT}`);
});
