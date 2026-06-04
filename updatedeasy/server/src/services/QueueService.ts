import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class QueueService {
  private queue: Queue;
  private connection: Redis;

  constructor() {
    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.connection.on('error', (err: any) => {
      logger.error({ err: err.message }, 'Redis error in QueueService');
    });

    this.queue = new Queue('enrollment-queue', {
      connection: this.connection as any,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // wait 5s, 10s, 20s...
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    logger.info('QueueService successfully initialized with enrollment-queue');
  }

  async enqueueEnrollment(jobId: string, data: { orderId: string; paymentId: string; signature?: string }) {
    try {
      const job = await this.queue.add('process-enrollment', data, { jobId });
      logger.info({ jobId: job.id, data }, 'Enrollment job successfully added to queue');
      return job;
    } catch (err: any) {
      logger.error({ err: err.message, jobId }, 'Failed to enqueue enrollment job');
      throw err;
    }
  }

  async close() {
    await this.queue.close();
    await this.connection.quit();
  }
}
export const queueService = new QueueService();
