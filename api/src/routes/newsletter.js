/**
 * Newsletter Routes — Mailchimp Integration
 *
 * [AV-030] feat: mailchimp email list
 *
 * POST /api/newsletter/subscribe
 *   - Adds email to Mailchimp list
 *   - Handles already-subscribed gracefully
 *   - Graceful failure if Mailchimp not configured
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const subscribeBody = z.object({
  email: z.string().email('Valid email required'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

router.post('/subscribe', validate(subscribeBody, 'body'), async (req, res, next) => {
  try {
    const { email, firstName, lastName } = req.body;

    const apiKey = process.env.MAILCHIMP_API_KEY;
    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
    const listId = process.env.MAILCHIMP_LIST_ID;

    if (!apiKey || !serverPrefix || !listId) {
      // Graceful: accept the signup even if Mailchimp isn't configured
      console.warn('[NEWSLETTER] Mailchimp not configured. Email not synced:', email);
      return res.json({ subscribed: true, message: 'Thank you for subscribing!' });
    }

    // [AV-067] v5.4.8 — MAILCHIMP_BASE_URL routes to a local stub for offline dev
    const baseUrl = process.env.MAILCHIMP_BASE_URL
      || `https://${serverPrefix}.api.mailchimp.com`;

    const response = await fetch(
      `${baseUrl}/3.0/lists/${listId}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: {
            FNAME: firstName || '',
            LNAME: lastName || '',
          },
        }),
      }
    );

    if (response.ok) {
      return res.json({ subscribed: true, message: 'Thank you for subscribing!' });
    }

    const data = await response.json();

    // Already subscribed — treat as success
    if (data.title === 'Member Exists') {
      return res.json({ subscribed: true, message: 'You are already subscribed!' });
    }

    // Compliance status — email is in the list but unsubscribed/cleaned
    if (data.status === 400 && data.title === 'Invalid Resource') {
      return res.json({ subscribed: false, message: 'This email cannot be subscribed. It may have been previously unsubscribed.' });
    }

    throw new Error(data.detail || 'Mailchimp subscription failed');
  } catch (error) {
    console.error('[NEWSLETTER] Mailchimp error:', error.message);
    // [AV-061] v5.4.2 — DON'T lie to the user. If Mailchimp fails, tell them
    // so they can retry. The old code returned { subscribed: true } on error,
    // meaning users thought they were on the list when they weren't.
    res.status(502).json({
      subscribed: false,
      message: 'We\'re having trouble subscribing you right now. Please try again in a moment.',
    });
  }
});

module.exports = router;
