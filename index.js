require('dotenv').config();
const Fastify = require('fastify');
const { startBot } = require('./bot');
const logger = require('./utils/logger');

// Create Fastify instance
const app = Fastify({
  logger: process.env.LOG_LEVEL || 'info'
});

// ===== BASIC TEST ROUTE =====
app.get('/', async () => {
  return { status: 'ok', message: 'Zenorz Dashboard API is running!' };
});

// ===== OAUTH ROUTES =====
app.register(require('./backend/oauth'), { prefix: '/auth' });

// ===== START EVERYTHING =====
async function start() {
  try {
    // Start bot
    await startBot();

    // Start API
    const PORT = process.env.PORT || 3000;
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Backend running at http://localhost:${PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
