import dotenv from 'dotenv';
import { z } from 'zod';
import { EmailAccount } from './types/index.js';

dotenv.config();

const configSchema = z.object({
  serviceName: z.string().default('com.mcp.mail-server'),
  logLevel: z.string().default('info'),
});

export const config = configSchema.parse({
  serviceName: process.env.SERVICE_NAME,
  logLevel: process.env.LOG_LEVEL,
});

/**
 * Parses the ACCOUNTS environment variable which should be a JSON string
 * representing an array of EmailAccount objects.
 */
export function getAccounts(): EmailAccount[] {
  const accountsJson = process.env.ACCOUNTS_JSON;
  if (!accountsJson) {
    return [];
  }
  try {
    return JSON.parse(accountsJson) as EmailAccount[];
  } catch (error) {
    console.error('Failed to parse ACCOUNTS_JSON:', error);
    return [];
  }
}
