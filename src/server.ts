import { app } from './app';
import { env } from './config';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';
import { startBackgroundJobs, stopBackgroundJobs } from './jobs';

const startServer = async () => {
  try {
    // Verify database connection on startup
    logger.info('Connecting to MongoDB via Prisma...');
    await prisma.$connect();
    logger.info('✅ Successfully connected to MongoDB.');

    // Initialize and start background cron jobs
    startBackgroundJobs();

    const server = app.listen(env.PORT, () => {
      logger.info(
        `🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT} (PID: ${process.pid})`
      );
      logger.info(`🔗 Health check: http://localhost:${env.PORT}/api/v1/health`);
      logger.info(`📖 API Docs: http://localhost:${env.PORT}/api-docs`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      stopBackgroundJobs();
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await prisma.$disconnect();
          logger.info('Prisma disconnected.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during Prisma disconnection');
          process.exit(1);
        }
      });

      // Force shutdown after 10s if hanging
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Unhandled Promise Rejection');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception! Server shutting down...');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
};

startServer();
