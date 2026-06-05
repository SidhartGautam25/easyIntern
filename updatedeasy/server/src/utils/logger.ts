import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import os from 'os';
import pinoModule from 'pino';

const pino = (pinoModule as any).default || pinoModule;

const isDev = process.env.NODE_ENV === 'development';

type RequestLogContext = {
  requestId?: string;
  traceId?: string;
};

export type ErrorCategory =
  | 'application'
  | 'auth'
  | 'database'
  | 'email'
  | 'external_service'
  | 'payment'
  | 'queue'
  | 'redis'
  | 'validation'
  | 'unknown';

type AuditLogPayload = Record<string, unknown> & {
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  outcome?: 'success' | 'failure' | 'denied' | 'started';
};

const requestContext = new AsyncLocalStorage<RequestLogContext>();

const redactPaths = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'newPassword',
  'passwordToSet',
  'otp',
  'token',
  'access_token',
  'refresh_token',
  'razorpay_signature',
  'clientSignature',
  'generatedSig',
  'expectedSig',
  'signatureHeader',
  'keySecret',
  'webhookSecret',
  'smtpPass',
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'body.password',
  'body.newPassword',
  'body.otp',
  'body.token',
  'data.password',
  'data.otp',
  'studentData.password',
  'studentData.metadata.password',
  'profileData.password',
  'insertPayload.password',
  'insertPayload.metadata.password',
  'order.metadata.password',
  'order.metadata.otp',
  'mailOptions.html',
  'html',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME || 'ezyintern-server',
    environment: process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  errorKey: 'error',
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  mixin() {
    const store = requestContext.getStore();
    return {
      ...(store?.requestId ? { requestId: store.requestId } : {}),
      ...(store?.traceId ? { traceId: store.traceId } : {}),
    };
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,service,environment',
          messageKey: 'message',
        },
      }
    : undefined,
});

export function runWithRequestContext<T>(context: RequestLogContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function getTraceId(): string | undefined {
  return requestContext.getStore()?.traceId;
}

export function createTraceId(): string {
  return cryptoSafeRandomHex(16);
}

export function parseTraceId(traceparent?: string): string | undefined {
  if (!traceparent) return undefined;

  const parts = traceparent.trim().split('-');
  const traceId = parts[1];
  if (parts.length >= 4 && isValidTraceId(traceId)) {
    return traceId;
  }

  return undefined;
}

export function normalizeTraceId(traceId?: string): string | undefined {
  if (!traceId) return undefined;

  const normalizedTraceId = traceId.trim().toLowerCase();
  return isValidTraceId(normalizedTraceId) ? normalizedTraceId : undefined;
}

function isValidTraceId(traceId?: string): boolean {
  return Boolean(traceId && /^[a-f0-9]{32}$/.test(traceId) && traceId !== '00000000000000000000000000000000');
}

function cryptoSafeRandomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

export const auditLogger = logger.child({ logType: 'audit' });
export const performanceLogger = logger.child({ logType: 'performance' });
export const httpLogger = logger.child({ logType: 'http' });
export const errorLogger = logger.child({ logType: 'error' });

export function withErrorCategory(category: ErrorCategory, fields: Record<string, unknown> = {}) {
  return {
    errorCategory: category,
    event: {
      category: 'error',
      action: `${category}.error`,
      outcome: 'failure',
    },
    ...fields,
  };
}

export function categorizeError(error: any, path?: string): ErrorCategory {
  const status = Number(error?.status || error?.statusCode || 0);
  const statusCategory = categorizeByStatus(status);
  if (statusCategory) return statusCategory;

  const code = String(error?.code || '').toLowerCase();
  const codeCategory = categorizeByErrorCode(code);
  if (codeCategory) return codeCategory;

  const name = String(error?.name || '').toLowerCase();
  const nameCategory = categorizeByErrorName(name);
  if (nameCategory) return nameCategory;

  const message = String(error?.message || '').toLowerCase();
  const errorPath = path?.toLowerCase() || '';
  const messageCategory = categorizeByMessage(message, errorPath);
  if (messageCategory) return messageCategory;

  return 'application';
}

function categorizeByStatus(status: number): ErrorCategory | undefined {
  if (status === 400) return 'validation';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'payment';
  if (status >= 500) return 'application';

  return undefined;
}

function categorizeByErrorCode(code: string): ErrorCategory | undefined {
  if (!code) return undefined;

  if (code.startsWith('pgrst') || code.startsWith('23')) return 'database';
  if (code.includes('redis')) return 'redis';
  if (code.includes('queue') || code.includes('bullmq')) return 'queue';
  if (code.includes('auth') || code.includes('jwt') || code.includes('token')) return 'auth';
  if (code.includes('payment') || code.includes('razorpay') || code.includes('signature')) return 'payment';
  if (code.includes('smtp') || code.includes('mail') || code.includes('email')) return 'email';
  if (code.includes('timeout') || code.includes('gateway')) return 'external_service';

  return undefined;
}

function categorizeByErrorName(name: string): ErrorCategory | undefined {
  if (!name) return undefined;

  if (name === 'zoderror' || name.includes('validation')) return 'validation';
  if (name.includes('auth') || name.includes('jwt') || name.includes('token')) return 'auth';
  if (name.includes('database') || name.includes('postgres') || name.includes('supabase')) return 'database';
  if (name.includes('redis') || name.includes('redlock')) return 'redis';
  if (name.includes('queue') || name.includes('bullmq')) return 'queue';
  if (name.includes('payment') || name.includes('razorpay')) return 'payment';
  if (name.includes('smtp') || name.includes('mail') || name.includes('email')) return 'email';

  return undefined;
}

function categorizeByMessage(message: string, errorPath: string): ErrorCategory | undefined {
  if (errorPath.includes('/payment') || errorPath.includes('/webhook') || message.includes('razorpay') || message.includes('payment') || message.includes('signature')) return 'payment';
  if (message.includes('redis') || message.includes('redlock')) return 'redis';
  if (message.includes('queue') || message.includes('bullmq')) return 'queue';
  if (message.includes('smtp') || message.includes('mail') || message.includes('email')) return 'email';
  if (message.includes('supabase') || message.includes('database') || message.includes('postgres')) return 'database';
  if (message.includes('auth') || message.includes('jwt') || message.includes('token')) return 'auth';
  if (message.includes('validation') || message.includes('invalid payload')) return 'validation';
  if (message.includes('external') || message.includes('gateway') || message.includes('timeout')) return 'external_service';

  return undefined;
}

export function audit(payload: AuditLogPayload, message = 'Audit event recorded') {
  auditLogger.info(
    {
      event: {
        category: 'audit',
        action: payload.action,
        outcome: payload.outcome || 'success',
      },
      ...payload,
    },
    message
  );
}

export function logPerformance(
  operation: string,
  durationMs: number,
  fields: Record<string, unknown> = {},
  level: 'debug' | 'info' | 'warn' = 'info'
) {
  performanceLogger[level](
    {
      event: {
        category: 'performance',
        action: operation,
      },
      operation,
      durationMs,
      ...fields,
    },
    'Performance measurement recorded'
  );
}

export async function measureAsync<T>(
  operation: string,
  callback: () => Promise<T>,
  fields: Record<string, unknown> = {}
): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await callback();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logPerformance(operation, durationMs, fields, durationMs >= Number(process.env.SLOW_OPERATION_MS || 1000) ? 'warn' : 'debug');
  }
}
