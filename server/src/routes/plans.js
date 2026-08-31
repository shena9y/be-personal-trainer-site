import { Router } from 'express';

export function plansRouter(queries) {
  const router = Router();

  // GET /api/plans — the three training tiers (seeded to match the site copy)
  router.get('/', (req, res) => {
    res.json({ plans: queries.listPlans() });
  });

  return router;
}