import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EmailAccount } from './types/index.js';

export const ACCOUNTS_PATH = path.join(os.homedir(), '.config', 'mail-mcp', 'accounts.json');

const configSchema = z.object({
  serviceName: z.string().default('ch.honest-magic.config.mail-server'),
  logLevel: z.string().default('info'),
});

export const config = configSchema.parse({
  serviceName: process.env.SERVICE_NAME,
  logLevel: process.env.LOG_LEVEL,
});

/**
 * Writes account definitions to ~/.config/mail-mcp/accounts.json.
 * Creates the directory if it does not exist.
 */
export function saveAccounts(accounts: EmailAccount[]): void {
  const configPath = ACCOUNTS_PATH;
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(accounts, null, 2), 'utf-8');
}

/**
 * Reads account definitions from ~/.config/mail-mcp/accounts.json.
 * Returns an empty array if the file does not exist or cannot be parsed.
 */
export function getAccounts(): EmailAccount[] {
  const configPath = ACCOUNTS_PATH;

  if (!fs.existsSync(configPath)) {
    console.error('No accounts config found at ~/.config/mail-mcp/accounts.json');
    return [];
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`Failed to parse accounts config at ${configPath}: expected an array`);
      return [];
    }
    return parsed as EmailAccount[];
  } catch (error) {
    console.error(`Failed to parse accounts config at ${configPath}:`, error);
    return [];
  }
}
