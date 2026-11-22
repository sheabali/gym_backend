import { prisma } from '../../lib/prisma';

export interface HealthCheckResult {
  status: 'UP' | 'DOWN';
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected';
    responseTimeMs?: number;
    error?: string;
  };
}

export const checkHealth = async (): Promise<HealthCheckResult> => {
  const start = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let responseTimeMs: number | undefined;
  let dbError: string | undefined;

  try {
    // Ping MongoDB through Prisma's raw command
    await prisma.$runCommandRaw({ ping: 1 });
    dbStatus = 'connected';
    responseTimeMs = Date.now() - start;
  } catch (err) {
    dbStatus = 'disconnected';
    dbError = err instanceof Error ? err.message : 'Unknown database error';
  }

  return {
    status: dbStatus === 'connected' ? 'UP' : 'DOWN',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      ...(responseTimeMs !== undefined && { responseTimeMs }),
      ...(dbError && { error: dbError }),
    },
  };
};
