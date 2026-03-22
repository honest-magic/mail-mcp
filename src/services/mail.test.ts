import { vi, describe, it, expect } from 'vitest';

const mockImapConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../protocol/imap.js', () => ({
  ImapClient: vi.fn().mockImplementation(() => ({
    connect: mockImapConnect,
  })),
}));

vi.mock('../protocol/smtp.js', () => ({
  SmtpClient: vi.fn().mockImplementation(() => ({
    connect: mockSmtpConnect,
  })),
}));

import { MailService } from './mail.js';

describe('ROM-07: MailService SMTP skip in read-only mode', () => {
  it('Test R: connect() calls smtpClient.connect() when readOnly=false', async () => {
    mockSmtpConnect.mockClear();
    const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };
    const service = new MailService(account, false);
    await service.connect();
    expect(mockSmtpConnect).toHaveBeenCalledTimes(1);
  });

  it('Test S: connect() does NOT call smtpClient.connect() when readOnly=true', async () => {
    mockSmtpConnect.mockClear();
    const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };
    const service = new MailService(account, true);
    await service.connect();
    expect(mockSmtpConnect).not.toHaveBeenCalled();
  });
});
