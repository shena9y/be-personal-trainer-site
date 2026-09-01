import 'dotenv/config';
import { createApp, SITE_ROOT } from './app.js';

const { app, db, config } = createApp();

// `SERVER_ROOT` would be nicer to print, but this is kept simple.
const server = app.listen(config.port, config.host, () => {
  const { port } = server.address();
  const admin = config.adminApiKey === '805321854174480704939529606805'
    ? '805321854174480704939529606805 (DEFAULT — set ADMIN_API_KEY!)'
    : 'configured, set via ADMIN_API_KEY';

  console.log('Be Personal Trainer backend');
  console.log('─────────────────────────────────────────');
  console.log(`  Site:        http://${config.host}:${port}/`);
  console.log(`  Health:      http://${config.host}:${port}/healthz`);
  console.log(`  Plans API:   http://${config.host}:${port}/api/plans`);
  console.log(`  Stats API:   http://${config.host}:${port}/api/stats`);
  console.log(`  Contact API: http://${config.host}:${port}/api/contact`);
  console.log(`  Admin API:   http://${config.host}:${port}/api/messages (${admin})`);
  console.log(`  Static root: ${SITE_ROOT}`);
  console.log(`  Database:    ${config.databasePath}`);
  console.log('─────────────────────────────────────────');
  console.log('Press Ctrl+C to stop.');
});

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down…`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // already closed
    }
    process.exit(0);
  });
  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
