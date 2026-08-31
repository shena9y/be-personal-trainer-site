import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAdminAccess } from '../middleware/adminAuth.js';
import { MESSAGE_STATUSES } from '../db.js';

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export function messagesRouter(db, queries, config) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.get('x-admin-key') === config.adminApiKey,
    message: {
      error: { code: 'RATE_LIMIT', message: 'Too many requests — slow down.' },
    },
  });

  router.use(requireAdminAccess(queries, config), limiter);

  // GET /api/messages — list received messages (newest first)
  router.get('/', (req, res, next) => {
    try {
      const status = req.query.status ?? null;
      const limit = clamp(Number.parseInt(req.query.limit ?? '50', 10) || 50, 1, 100);
      const offset = clamp(Number.parseInt(req.query.offset ?? '0', 10) || 0, 0, 1_000_000);
      const { messages, total } = queries.listMessages({
        status: MESSAGE_STATUSES.has(status) ? status : null,
        limit,
        offset,
      });
      res.json({ messages, total, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/messages/:id — mark a message read/unread/archived
  router.patch('/:id', (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Invalid message id.' },
        });
      }
      const status = req.body?.status;
      if (!MESSAGE_STATUSES.has(status)) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: `status must be one of: ${[...MESSAGE_STATUSES].join(', ')}.`,
          },
        });
      }
      const updated = queries.updateMessageStatus(id, status);
      if (!updated) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `No message with id ${id}.` },
        });
      }
      res.json({ message: updated });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/messages/:id — permanently remove a message
  router.delete('/:id', (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Invalid message id.' },
        });
      }
      const removed = queries.deleteMessage(id);
      if (!removed) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `No message with id ${id}.` },
        });
      }
      res.json({ ok: true, deletedId: id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}