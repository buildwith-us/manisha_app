import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectRedis, initRedis } from './config/redis';

async function bootstrap(): Promise<void> {
  if (env.NODE_ENV === 'production' && env.UNSAFE_DEV_MODE) {
    // Loud on purpose. In this state anyone who knows a phone number can sign
    // in as that person with the fixed code.
    logger.warn('!'.repeat(58));
    logger.warn('UNSAFE_DEV_MODE is ON in production.');
    logger.warn(`Any number can sign in with the fixed OTP "${env.OTP_FAKE_CODE}".`);
    logger.warn('This is for pre-launch testing only — unset it before go-live.');
    logger.warn('!'.repeat(58));
  }

  initRedis();
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down.`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      process.exit(0);
    });
    // Do not let a hung connection hold the process open forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start the API', error);
  process.exit(1);
});
