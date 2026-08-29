import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/sessionAuth.js';

/**
 * Dashboard API. Any signed-in visitor sees their account; admins get the
 * site-wide summary used to populate the dashboard cards.
 */
export function dashboardRouter(queries) {
  const router = Router();

  // GET /api/dashboard — account info for the signed-in user
  router.get('/', requireAuth(queries), (req, res) => {
    res.json({ user: req.user });
  });

  // GET /api/dashboard/summary — admin-only counts for the dashboards cards
  router.get('/summary', requireAdmin(queries), (req, res) => {
    res.json({
      users: queries.countUsers(),
      messagesTotal: queries.countMessages(null),
      messagesUnread: queries.countMessages('unread'),
      plans: queries.listPlans().length,
    });
  });

  // GET /api/dashboard/users — admin-only list of registered accounts
  router.get('/users', requireAdmin(queries), (req, res) => {
    res.json({ users: queries.listUsers() });
  });

  return router;
}