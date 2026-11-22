import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z
    .string({
      required_error: 'DATABASE_URL is required',
    })
    .min(1, 'DATABASE_URL cannot be empty'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  // Authentication settings
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('super-secret-jwt-key-replace-in-production-12345'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Application URLs
  BACKEND_URL: z.string().default('http://localhost:8000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // SSLCommerz Payment Gateway settings
  SSLCOMMERZ_STORE_ID: z.string().default('testbox'),
  SSLCOMMERZ_STORE_PASS: z.string().default('qwerty'),
  SSLCOMMERZ_IS_SANDBOX: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),
  SSLCOMMERZ_GATEWAY_MODE: z.enum(['fake', 'sandbox', 'live']).default('fake'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid or missing environment configuration:');
  const formatted = parsedEnv.error.format();
  for (const [key, val] of Object.entries(formatted)) {
    if (key !== '_errors' && val && typeof val === 'object' && '_errors' in val) {
      const errMessages = (val as { _errors: string[] })._errors;
      if (errMessages.length > 0) {
        console.error(`   - ${key}: ${errMessages.join(', ')}`);
      }
    }
  }
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
