import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockImapConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpSend = vi.fn().mockResolvedValue({ messageId: 'test' });
const mockFetchAttachmentSize = vi.fn();
const mockFetchMessageBody = vi.fn();

vi.mock('../protocol/imap.js', () => {
  return {
    ImapClient: vi.fn(function () {
      return {
        connect: mockImapConnect,
        appendMessage: vi.fn().mockResolvedValue(undefined),
        fetchAttachmentSize: mockFetchAttachmentSize,
        fetchMessageBody: mockFetchMessageBody,
      };
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
    mockFetchAttachmentSize.mockClear();
    mockFetchMessageBody.mockClear();
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

describe('MailService attachment size guard', () => {
  const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };

  beforeEach(() => {
    mockFetchAttachmentSize.mockClear();
    mockFetchMessageBody.mockClear();
  });

  it('throws ValidationError when fetchAttachmentSize returns size exceeding 50MB', async () => {
    const SIXTY_MB = 60 * 1024 * 1024;
    mockFetchAttachmentSize.mockResolvedValue(SIXTY_MB);
    const service = new MailService(account, false);
    await service.connect();
    await expect(service.downloadAttachment('1', 'bigfile.pdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('bigfile.pdf'),
      })
    );
    await expect(service.downloadAttachment('1', 'bigfile.pdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('MB'),
      })
    );
    await expect(service.downloadAttachment('1', 'bigfile.pdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('limit'),
      })
    );
    expect(mockFetchMessageBody).not.toHaveBeenCalled();
  });

  it('throws ValidationError with code ValidationError when size exceeds limit', async () => {
    const SIXTY_MB = 60 * 1024 * 1024;
    mockFetchAttachmentSize.mockResolvedValue(SIXTY_MB);
    const { ValidationError } = await import('../errors.js');
    const service = new MailService(account, false);
    await service.connect();
    await expect(service.downloadAttachment('1', 'bigfile.pdf')).rejects.toBeInstanceOf(ValidationError);
  });

  it('proceeds to fetchMessageBody when size <= 50MB', async () => {
    const TEN_MB = 10 * 1024 * 1024;
    mockFetchAttachmentSize.mockResolvedValue(TEN_MB);
    mockFetchMessageBody.mockResolvedValue({
      attachments: [{ filename: 'small.pdf', content: Buffer.from('data'), contentType: 'application/pdf', size: TEN_MB }],
    });
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.downloadAttachment('1', 'small.pdf');
    expect(mockFetchMessageBody).toHaveBeenCalledOnce();
    expect(result.contentType).toBe('application/pdf');
  });

  it('proceeds to fetchMessageBody when fetchAttachmentSize returns null (BODYSTRUCTURE unavailable)', async () => {
    mockFetchAttachmentSize.mockResolvedValue(null);
    mockFetchMessageBody.mockResolvedValue({
      attachments: [{ filename: 'file.txt', content: Buffer.from('hello'), contentType: 'text/plain', size: 5 }],
    });
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.downloadAttachment('1', 'file.txt');
    expect(mockFetchMessageBody).toHaveBeenCalledOnce();
    expect(result.contentType).toBe('text/plain');
  });
});
