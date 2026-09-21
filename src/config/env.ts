import dotenv from 'dotenv';
import { z, ZodError } from 'zod';

import logger from '../utils/logger.js';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().positive().default(3000),
  PORT_DEV: z.coerce.number().int().positive().optional(),
  PORT_PROD: z.coerce.number().int().positive().optional(),

  MONGODB_URI: z.string().optional(),
  MONGODB_DEV: z.string().optional(),

  CLIENT_URL: z.string().optional(),
  CLIENT_DEV_URL: z.string().optional(),
  APP_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CLOUDINARY_URL: z.string().optional(),

  INIT_SUPERADMIN: z.string().optional(),
  SUPERADMIN_NAME: z.string().optional(),
  SUPERADMIN_LASTNAME: z.string().optional(),
  SUPERADMIN_EMAIL: z.string().optional(),
  SUPERADMIN_PASSWORD: z.string().optional(),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      return !!data.MONGODB_URI;
    }
    return !!data.MONGODB_DEV;
  },
  {
    message: 'MONGODB_URI required in production, MONGODB_DEV required in development',
  }
).refine(
  (data) => data.NODE_ENV !== 'production' || !!data.CLOUDINARY_URL,
  {
    message: 'CLOUDINARY_URL required in production (image uploads)',
  }
);

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error('Environment variable validation failed');
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        logger.error(`  - ${path || 'root'}: ${issue.message}`);
      });
      logger.error('Please check your .env file');
      process.exit(1);
    }
    throw error;
  }
}

const env = validateEnv();
export default env;