import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';

vi.mock('node:fs');
vi.mock('node:os');

const mockedFs = vi.mocked(fs);
const mockedOs = vi.mocked(os);

describe('config file loading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedOs.homedir.mockReturnValue('/home/testuser');
  });

  it('returns empty array when config file does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    // Re-import to pick up mocks
    const { getAccounts } = await import('./config.js');
    const result = getAccounts();

    expect(result).toEqual([]);
  });

  it('parses valid accounts.json', async () => {
    const account = {
      id: 'work',
      name: 'Work Email',
      host: 'imap.example.com',
      port: 993,
      user: 'you@example.com',
      authType: 'login' as const,
      useTLS: true,
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([account]));

    const { getAccounts } = await import('./config.js');
    const result = getAccounts();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('work');
    expect(result[0].host).toBe('imap.example.com');
  });

  it('returns empty array on invalid JSON', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{ this is not valid json');

    const { getAccounts } = await import('./config.js');
    const result = getAccounts();

    expect(result).toEqual([]);
  });
});
