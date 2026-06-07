import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { enrollmentWorker } from './queue/enrollmentWorker.js';
import { queueService } from './services/QueueService.js';

const server = http.createServer(app.callback());
const PORT = config.port;

function startServer() {
  server.listen(PORT, () => {
    logger.info(`🚀 EzyIntern Koa Backend Server is running on port ${PORT} in ${config.nodeEnv} mode`);
  });
}

// Graceful Shutdown Handlers
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new HTTP requests
  server.close(() => {
    logger.info('HTTP server closed.');
  });

  try {
    // Close background worker
    logger.info('Closing BullMQ enrollment worker...');
    await enrollmentWorker.close();
    logger.info('Enrollment worker closed.');

    // Close Queue service (Producer client)
    logger.info('Closing Queue service connection...');
    await queueService.close();
    logger.info('Queue service connection closed.');

    logger.info('Graceful shutdown completed successfully. Exiting.');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error occurred during graceful shutdown');
    process.exit(1);
  }
}

// Intercept termination and interrupt signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason: any, _promise) => {
  logger.fatal({ reason: reason?.message || reason, stack: reason?.stack }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Bootstrap server
startServer();
