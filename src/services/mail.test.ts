import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockImapConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpSend = vi.fn().mockResolvedValue({ messageId: 'test' });

vi.mock('../protocol/imap.js', () => {
  return {
    ImapClient: vi.fn(function () {
      return { connect: mockImapConnect, appendMessage: vi.fn().mockResolvedValue(undefined) };
    }),
  };
});

vi.mock('../protocol/smtp.js', () => {
  return {
    SmtpClient: vi.fn(function () {
      return { connect: mockSmtpConnect, send: mockSmtpSend };
    }),
  };
});

import { MailService } from './mail.js';

describe('MailService SMTP connection behavior', () => {
  beforeEach(() => {
    mockImapConnect.mockClear();
    mockSmtpConnect.mockClear();
    mockSmtpSend.mockClear();
  });

  it('connect() does NOT call smtpClient.connect() eagerly', async () => {
    const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };
    const service = new MailService(account, false);
    await service.connect();
    expect(mockSmtpConnect).not.toHaveBeenCalled();
  });

  it('connect() does NOT call smtpClient.connect() when readOnly=true', async () => {
    const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };
    const service = new MailService(account, true);
    await service.connect();
    expect(mockSmtpConnect).not.toHaveBeenCalled();
  });

  it('SMTP connects lazily on first sendEmail', async () => {
    const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };
    const service = new MailService(account, false);
    await service.connect();
    expect(mockSmtpConnect).not.toHaveBeenCalled();
    await service.sendEmail('to@test.com', 'subject', 'body');
    expect(mockSmtpConnect).toHaveBeenCalledTimes(1);
  });
});
