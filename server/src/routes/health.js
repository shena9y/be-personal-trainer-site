import { Router } from 'express';
import pkg from '../../package.json' with { type: 'json' };

export function healthRouter(db, config) {
  const router = Router();

  // GET /healthz — liveness + database check
  router.get('/', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({
        status: 'ok',
        db: 'up',
        uptime: process.uptime(),
        version: pkg.version,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'error',
        db: 'down',
        message: 'Database is unreachable.',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}