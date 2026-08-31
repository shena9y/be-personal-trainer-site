import { Router } from 'express';

export function statsRouter(queries) {
  const router = Router();

  // GET /api/stats — the coaching figures shown in the stats bar
  router.get('/', (req, res) => {
    res.json({ stats: queries.listStats() });
  });

  return router;
}