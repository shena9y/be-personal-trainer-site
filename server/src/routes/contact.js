import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateContact } from '../validate.js';
import { sendMessageNotification } from '../mailer.js';

export function contactRouter(db, queries, config) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: config.contactRateLimitWindowMs,
    limit: config.contactRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests — please wait a few minutes and try again.',
      },
    },
  });

  // POST /api/contact — accept a message from the contact form
  router.post('/', limiter, async (req, res, next) => {
    try {
      const { errors, value } = validateContact(req.body);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please fix the highlighted fields and try again.',
            fields: errors,
          },
        });
      }

      // Honeypot was filled → pretend success, persist nothing.
      if (value.honeypot) {
        return res.status(200).json({
          success: true,
          id: null,
          message: "Thanks — your message has been sent. I'll get back to you within 1 business day.",
        });
      }

      const id = queries.insertMessage({
        name: value.name,
        email: value.email,
        subject: value.subject,
        message: value.message,
        plan: value.plan,
        ip: req.ip ?? null,
        userAgent: String(req.get('user-agent') ?? '').slice(0, 300) || null,
      });
      const stored = queries.getMessage(id);

      // Notify the trainer by e-mail when SMTP is configured; never block the
      // response on it.
      await sendMessageNotification(stored, config).catch((err) => {
        console.error('[mailer] notification failed:', err.message);
      });

      res.status(201).json({
        success: true,
        id: Number(id),
        message: "Thanks — your message has been sent. I'll get back to you within 1 business day.",
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}