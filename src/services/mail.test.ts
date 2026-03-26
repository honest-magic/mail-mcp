import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockImapConnect = vi.fn().mockResolvedValue(undefined);
const mockImapAppendMessage = vi.fn().mockResolvedValue(undefined);
const mockSmtpConnect = vi.fn().mockResolvedValue(undefined);
const mockSmtpSend = vi.fn().mockResolvedValue({ messageId: 'test' });
const mockFetchAttachmentSize = vi.fn();
const mockFetchMessageBody = vi.fn();

vi.mock('../protocol/imap.js', () => {
  return {
    ImapClient: vi.fn(function () {
      return {
        connect: mockImapConnect,
        appendMessage: mockImapAppendMessage,
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

import { MailService, applySignature } from './mail.js';

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

// ---------------------------------------------------------------------------
// applySignature pure helper tests
// ---------------------------------------------------------------------------

describe('applySignature helper', () => {
  it('returns body unchanged when signature is undefined and includeSignature is true', () => {
    expect(applySignature('Hello', undefined, false, true)).toBe('Hello');
  });

  it('returns body unchanged when signature is undefined and includeSignature is false', () => {
    expect(applySignature('Hello', undefined, false, false)).toBe('Hello');
  });

  it('returns body unchanged when includeSignature is false even if signature is set', () => {
    expect(applySignature('Hello', 'Best', false, false)).toBe('Hello');
  });

  it('appends plain text signature with RFC 3676 separator when includeSignature is true', () => {
    expect(applySignature('Hello', 'Best', false, true)).toBe('Hello\n-- \nBest');
  });

  it('appends HTML-wrapped signature when body is HTML and includeSignature is true', () => {
    expect(applySignature('<p>Hello</p>', 'Best', true, true)).toBe(
      '<p>Hello</p><br><br><p style="white-space: pre-line">-- \nBest</p>'
    );
  });

  it('returns HTML body unchanged when includeSignature is false even if signature is set', () => {
    expect(applySignature('<p>Hello</p>', 'Best', true, false)).toBe('<p>Hello</p>');
  });
});

// ---------------------------------------------------------------------------
// sendEmail with signature tests
// ---------------------------------------------------------------------------

describe('MailService sendEmail with signature', () => {
  const baseAccount = { id: 'test', name: 'Test', user: 'test@example.com', authType: 'login' as const, host: 'imap.example.com', port: 993, useTLS: true };

  beforeEach(() => {
    mockSmtpConnect.mockClear();
    mockSmtpSend.mockClear();
  });

  it('appends signature to body when account has signature and includeSignature is true (default)', async () => {
    const account = { ...baseAccount, signature: 'Best regards,\nAlice' };
    const service = new MailService(account, false);
    await service.connect();
    await service.sendEmail('to@example.com', 'Hi', 'Hello there');
    expect(mockSmtpSend).toHaveBeenCalledWith(
      'to@example.com',
      'Hi',
      'Hello there\n-- \nBest regards,\nAlice',
      false,
      undefined,
      undefined
    );
  });

  it('does not append signature when includeSignature is false', async () => {
    const account = { ...baseAccount, signature: 'Best regards,\nAlice' };
    const service = new MailService(account, false);
    await service.connect();
    await service.sendEmail('to@example.com', 'Hi', 'Hello there', false, undefined, undefined, false);
    expect(mockSmtpSend).toHaveBeenCalledWith(
      'to@example.com',
      'Hi',
      'Hello there',
      false,
      undefined,
      undefined
    );
  });

  it('does not append signature when account has no signature', async () => {
    const account = { ...baseAccount };
    const service = new MailService(account, false);
    await service.connect();
    await service.sendEmail('to@example.com', 'Hi', 'Hello there');
    expect(mockSmtpSend).toHaveBeenCalledWith(
      'to@example.com',
      'Hi',
      'Hello there',
      false,
      undefined,
      undefined
    );
  });
});

// ---------------------------------------------------------------------------
// createDraft with signature tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// readEmail List-Unsubscribe header extraction tests
// ---------------------------------------------------------------------------

describe('readEmail List-Unsubscribe header extraction', () => {
  const account = { id: 'test', name: 'Test', user: 'test@example.com', imap: {} as any, smtp: {} as any };

  beforeEach(() => {
    mockFetchMessageBody.mockClear();
  });

  function makeParsedMail(headers: Record<string, string>, extra: Partial<any> = {}): any {
    const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      from: { text: 'sender@example.com' },
      to: { text: 'recipient@example.com' },
      subject: 'Test Email',
      date: new Date('2026-01-01T00:00:00Z'),
      text: 'Hello world',
      headers: map,
      attachments: [],
      ...extra,
    };
  }

  it('outputs Unsubscribe https line when List-Unsubscribe contains an https URL', async () => {
    mockFetchMessageBody.mockResolvedValue(
      makeParsedMail({ 'list-unsubscribe': '<https://example.com/unsub?token=abc>' })
    );
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.readEmail('1');
    expect(result).toContain('**Unsubscribe:** https://example.com/unsub?token=abc');
  });

  it('outputs Unsubscribe mailto line when List-Unsubscribe contains a mailto URL', async () => {
    mockFetchMessageBody.mockResolvedValue(
      makeParsedMail({ 'list-unsubscribe': '<mailto:unsub@list.example.com>' })
    );
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.readEmail('1');
    expect(result).toContain('**Unsubscribe (mailto):** unsub@list.example.com');
  });

  it('outputs both https and mailto lines when List-Unsubscribe contains both', async () => {
    mockFetchMessageBody.mockResolvedValue(
      makeParsedMail({
        'list-unsubscribe': '<mailto:unsub@list.example.com>, <https://example.com/unsub?token=xyz>',
      })
    );
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.readEmail('1');
    expect(result).toContain('**Unsubscribe:** https://example.com/unsub?token=xyz');
    expect(result).toContain('**Unsubscribe (mailto):** unsub@list.example.com');
  });

  it('does not output any Unsubscribe line when List-Unsubscribe header is absent', async () => {
    mockFetchMessageBody.mockResolvedValue(makeParsedMail({}));
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.readEmail('1');
    expect(result).not.toContain('Unsubscribe');
  });

  it('outputs one-click line when List-Unsubscribe-Post is present', async () => {
    mockFetchMessageBody.mockResolvedValue(
      makeParsedMail({
        'list-unsubscribe': '<https://example.com/unsub>',
        'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
      })
    );
    const service = new MailService(account, false);
    await service.connect();
    const result = await service.readEmail('1');
    expect(result).toContain('**Unsubscribe:** https://example.com/unsub');
    expect(result).toContain('**Unsubscribe (one-click):** yes');
  });
});

describe('MailService createDraft with signature', () => {
  const baseAccount = { id: 'test', name: 'Test', user: 'test@example.com', authType: 'login' as const, host: 'imap.example.com', port: 993, useTLS: true };

  beforeEach(() => {
    mockImapAppendMessage.mockClear();
  });

  it('appends signature to draft body when account has signature and includeSignature is true (default)', async () => {
    const account = { ...baseAccount, signature: 'Regards' };
    const service = new MailService(account, false);
    await service.connect();
    await service.createDraft('to@example.com', 'Draft', 'Body text');
    expect(mockImapAppendMessage).toHaveBeenCalledOnce();
    const rawMessage: string = mockImapAppendMessage.mock.calls[0][1];
    // body ends with \r\n after joining, then effectiveBody appended — check signature present
    expect(rawMessage).toContain('Body text\n-- \nRegards');
  });

  it('does not append signature to draft when includeSignature is false', async () => {
    const account = { ...baseAccount, signature: 'Regards' };
    const service = new MailService(account, false);
    await service.connect();
    await service.createDraft('to@example.com', 'Draft', 'Body text', false, undefined, undefined, false);
    expect(mockImapAppendMessage).toHaveBeenCalledOnce();
    const rawMessage: string = mockImapAppendMessage.mock.calls[0][1];
    expect(rawMessage).not.toContain('-- \n');
    expect(rawMessage).toContain('Body text');
  });
});
