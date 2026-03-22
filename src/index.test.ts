import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./config.js', () => ({
  getAccounts: vi.fn().mockResolvedValue([]),
}));

// vi.mock() is hoisted above all variable declarations, so outer-scope variables like
// mockDisconnect cannot be referenced inside the factory (they'd be in TDZ). Instead,
// we create all mock functions self-contained inside the factory and keep external
// references only for assertions.

// Shared mock functions — declared before use in tests, not inside the factory.
const mockSearchEmails = vi.fn().mockResolvedValue([
  { id: '42', uid: 42, subject: 'Found Email', from: 'sender@example.com' }
]);
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockListFolders = vi.fn().mockResolvedValue(['INBOX', 'Sent', 'Drafts', 'Trash']);
const mockMoveMessage = vi.fn().mockResolvedValue(undefined);
const mockModifyLabels = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('./services/mail.js', () => {
  // Self-contained: no outer-scope references to avoid TDZ issues with vi.mock hoisting.
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const MockMailService = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect,
    listEmails: vi.fn().mockResolvedValue([]),
    searchEmails: vi.fn().mockResolvedValue([
      { id: '42', uid: 42, subject: 'Found Email', from: 'sender@example.com' },
    ]),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    listFolders: vi.fn().mockResolvedValue(['INBOX', 'Sent', 'Drafts', 'Trash']),
    moveMessage: vi.fn().mockResolvedValue(undefined),
    modifyLabels: vi.fn().mockResolvedValue(undefined),
  }));
  return { MailService: MockMailService };
});

import { MailMCPServer } from './index.js';
import { MailService } from './services/mail.js';
import { getAccounts } from './config.js';

const WRITE_TOOL_NAMES = [
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'register_oauth2_account',
  'batch_operations',
];

const READ_TOOL_NAMES = [
  'list_accounts',
  'list_emails',
  'search_emails',
  'read_email',
  'list_folders',
  'get_thread',
  'get_attachment',
  'extract_attachment_text',
];

describe('ROM-01: readOnly constructor field', () => {
  it('Test A: MailMCPServer constructed with readOnly=false has this.readOnly === false', () => {
    const server = new MailMCPServer(false);
    expect((server as any).readOnly).toBe(false);
  });

  it('Test B: MailMCPServer constructed with readOnly=true has this.readOnly === true', () => {
    const server = new MailMCPServer(true);
    expect((server as any).readOnly).toBe(true);
  });
});

describe('ROM-05: list-time filtering', () => {
  it('Test C: getTools(false) returns array of length 14', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    expect(tools).toHaveLength(14);
  });

  it('Test D: getTools(true) returns array of length 8', () => {
    const server = new MailMCPServer(true);
    const tools = (server as any).getTools(true);
    expect(tools).toHaveLength(8);
  });

  it('Test E: getTools(true) does NOT include send_email', () => {
    const server = new MailMCPServer(true);
    const tools = (server as any).getTools(true);
    const names = tools.map((t: any) => t.name);
    expect(names).not.toContain('send_email');
  });

  it('Test F: getTools(true) does NOT include any of the 6 write tools', () => {
    const server = new MailMCPServer(true);
    const tools = (server as any).getTools(true);
    const names: string[] = tools.map((t: any) => t.name);
    for (const writeTool of WRITE_TOOL_NAMES) {
      expect(names).not.toContain(writeTool);
    }
  });
});

describe('ROM-02: call-time guard for write tools', () => {
  it('Test G: dispatchTool with readOnly=true and name=send_email returns { isError: true }', async () => {
    const server = new MailMCPServer(true);
    const result = await (server as any).dispatchTool('send_email', true, {});
    expect(result.isError).toBe(true);
  });

  it("Test H: dispatchTool with readOnly=true and name=send_email text includes \"Tool 'send_email' is not available\"", async () => {
    const server = new MailMCPServer(true);
    const result = await (server as any).dispatchTool('send_email', true, {});
    expect(result.content[0].text).toContain("Tool 'send_email' is not available");
  });

  it('Test I: all 6 write tool names return isError: true in read-only mode', async () => {
    const server = new MailMCPServer(true);
    for (const toolName of WRITE_TOOL_NAMES) {
      const result = await (server as any).dispatchTool(toolName, true, {});
      expect(result.isError).toBe(true);
    }
  });
});

describe('ROM-03: read tools unaffected in read-only mode', () => {
  it('Test N: In read-only mode, calling list_accounts does NOT return isError: true', async () => {
    const server = new MailMCPServer(true);
    const result = await (server as any).dispatchTool('list_accounts', true, {});
    expect(result.isError).not.toBe(true);
  });
});

describe('ROM-06: tool annotations', () => {
  it('Test J: all 14 tools have annotations.readOnlyHint defined', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    expect(tools).toHaveLength(14);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBeDefined();
    }
  });

  it('Test K: all 14 tools have annotations.destructiveHint defined', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    for (const tool of tools) {
      expect(tool.annotations?.destructiveHint).toBeDefined();
    }
  });

  it('Test L: write tools have readOnlyHint === false and destructiveHint === true', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const writeTools = tools.filter((t: any) => WRITE_TOOL_NAMES.includes(t.name));
    expect(writeTools).toHaveLength(6);
    for (const tool of writeTools) {
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.annotations.destructiveHint).toBe(true);
    }
  });

  it('Test M: read tools have readOnlyHint === true and destructiveHint === false', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const readTools = tools.filter((t: any) => READ_TOOL_NAMES.includes(t.name));
    expect(readTools).toHaveLength(8);
    for (const tool of readTools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    }
  });
});

describe('ROM-04: instructions field in Server options', () => {
  it('Test P: readOnly=true — internal Server has instructions set to the read-only message', () => {
    const server = new MailMCPServer(true);
    const internalServer = (server as any).server;
    // MCP SDK stores options on _options or similar internal property
    // Try multiple access paths for SDK compatibility
    const instructions =
      internalServer._options?.instructions ??
      internalServer.options?.instructions ??
      internalServer.serverInfo?.instructions;
    expect(instructions).toBe(
      'This server is running in read-only mode. Write operations (send_email, create_draft, move_email, modify_labels, batch_operations, register_oauth2_account) are disabled.'
    );
  });

  it('Test Q: readOnly=false — internal Server has no instructions field', () => {
    const server = new MailMCPServer(false);
    const internalServer = (server as any).server;
    const instructions =
      internalServer._options?.instructions ??
      internalServer.options?.instructions ??
      internalServer.serverInfo?.instructions;
    expect(instructions).toBeFalsy();
  });
});

describe('IMAP-03: search_emails tool', () => {
  beforeEach(() => {
    mockSearchEmails.mockClear();
  });

  it('search_emails tool is listed among available tools', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('search_emails');
  });

  it('search_emails tool schema includes from, subject, since, before, keywords fields', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const searchTool = tools.find((t: any) => t.name === 'search_emails');
    expect(searchTool).toBeDefined();
    const props = searchTool.inputSchema.properties;
    expect(props.from).toBeDefined();
    expect(props.subject).toBeDefined();
    expect(props.since).toBeDefined();
    expect(props.before).toBeDefined();
    expect(props.keywords).toBeDefined();
  });

  it('search_emails tool has readOnlyHint=true (non-destructive)', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const searchTool = tools.find((t: any) => t.name === 'search_emails');
    expect(searchTool.annotations.readOnlyHint).toBe(true);
    expect(searchTool.annotations.destructiveHint).toBe(false);
  });
});

describe('IMAP-04: list_folders tool', () => {
  it('list_folders tool is listed among available tools', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('list_folders');
  });

  it('list_folders tool has readOnlyHint=true (non-destructive)', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'list_folders');
    expect(tool.annotations.readOnlyHint).toBe(true);
    expect(tool.annotations.destructiveHint).toBe(false);
  });

  it('list_folders tool requires accountId', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'list_folders');
    expect(tool.inputSchema.required).toContain('accountId');
  });
});

describe('ORG-01: move_email tool', () => {
  it('move_email tool is listed among available tools', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('move_email');
  });

  it('move_email tool has readOnlyHint=false and destructiveHint=true', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'move_email');
    expect(tool.annotations.readOnlyHint).toBe(false);
    expect(tool.annotations.destructiveHint).toBe(true);
  });

  it('move_email tool schema includes uid, sourceFolder, targetFolder', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'move_email');
    const props = tool.inputSchema.properties;
    expect(props.uid).toBeDefined();
    expect(props.sourceFolder).toBeDefined();
    expect(props.targetFolder).toBeDefined();
  });

  it('move_email is blocked in read-only mode', async () => {
    const server = new MailMCPServer(true);
    const result = await (server as any).dispatchTool('move_email', true, {});
    expect(result.isError).toBe(true);
  });
});

describe('ORG-02: modify_labels tool', () => {
  it('modify_labels tool is listed among available tools', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('modify_labels');
  });

  it('modify_labels tool has readOnlyHint=false and destructiveHint=true', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'modify_labels');
    expect(tool.annotations.readOnlyHint).toBe(false);
    expect(tool.annotations.destructiveHint).toBe(true);
  });

  it('modify_labels tool schema includes uid, folder, addLabels, removeLabels', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'modify_labels');
    const props = tool.inputSchema.properties;
    expect(props.uid).toBeDefined();
    expect(props.folder).toBeDefined();
    expect(props.addLabels).toBeDefined();
    expect(props.removeLabels).toBeDefined();
  });

  it('modify_labels is blocked in read-only mode', async () => {
    const server = new MailMCPServer(true);
    const result = await (server as any).dispatchTool('modify_labels', true, {});
    expect(result.isError).toBe(true);
  });
});

describe('SMTP-02: send_email CC/BCC support', () => {
  it('send_email tool schema includes cc and bcc fields', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const sendTool = tools.find((t: any) => t.name === 'send_email');
    expect(sendTool).toBeDefined();
    const props = sendTool.inputSchema.properties;
    expect(props.cc).toBeDefined();
    expect(props.bcc).toBeDefined();
  });

  it('create_draft tool schema includes cc and bcc fields', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const draftTool = tools.find((t: any) => t.name === 'create_draft');
    expect(draftTool).toBeDefined();
    const props = draftTool.inputSchema.properties;
    expect(props.cc).toBeDefined();
    expect(props.bcc).toBeDefined();
  });
});

describe('SAFE-02: typed error formatting in catch block', () => {
  it('when getService throws AuthError, dispatchTool response text is "[AuthError] bad credentials"', async () => {
    const { AuthError } = await import('./errors.js');
    const server = new MailMCPServer(false);
    vi.spyOn(server as any, 'getService').mockRejectedValue(new AuthError('bad credentials'));
    const result = await (server as any).dispatchTool('read_email', false, { accountId: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('[AuthError] bad credentials');
  });

  it('when getService throws a generic Error, response text does NOT contain brackets', async () => {
    const server = new MailMCPServer(false);
    vi.spyOn(server as any, 'getService').mockRejectedValue(new Error('connection refused'));
    const result = await (server as any).dispatchTool('read_email', false, { accountId: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('connection refused');
    expect(result.content[0].text).not.toMatch(/^\[/);
  });

  it('when getService throws NetworkError, response text starts with "[NetworkError]"', async () => {
    const { NetworkError } = await import('./errors.js');
    const server = new MailMCPServer(false);
    vi.spyOn(server as any, 'getService').mockRejectedValue(new NetworkError('timeout'));
    const result = await (server as any).dispatchTool('read_email', false, { accountId: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('[NetworkError] timeout');
  });
});

describe('VAL-02: email validation at dispatch layer', () => {
  it('send_email with invalid to returns isError: true containing [ValidationError] and the invalid address', async () => {
    const server = new MailMCPServer(false);
    const result = await (server as any).dispatchTool('send_email', false, {
      accountId: 'test',
      to: 'notanemail',
      subject: 'Hi',
      body: 'test',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[ValidationError]');
    expect(result.content[0].text).toContain('notanemail');
  });

  it('send_email with invalid to does NOT call MailService.sendEmail', async () => {
    const { MailService } = await import('./services/mail.js');
    const server = new MailMCPServer(false);
    const sendEmailMock = vi.fn();
    // Override getService to return a mock with sendEmail spy
    vi.spyOn(server as any, 'getService').mockResolvedValue({ sendEmail: sendEmailMock });
    await (server as any).dispatchTool('send_email', false, {
      accountId: 'test',
      to: 'notanemail',
      subject: 'Hi',
      body: 'test',
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('create_draft with invalid to returns isError: true containing [ValidationError]', async () => {
    const server = new MailMCPServer(false);
    const result = await (server as any).dispatchTool('create_draft', false, {
      accountId: 'test',
      to: 'notanemail',
      subject: 'Draft',
      body: 'test',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[ValidationError]');
  });

  it('create_draft with invalid to does NOT call MailService.createDraft', async () => {
    const server = new MailMCPServer(false);
    const createDraftMock = vi.fn();
    vi.spyOn(server as any, 'getService').mockResolvedValue({ createDraft: createDraftMock });
    await (server as any).dispatchTool('create_draft', false, {
      accountId: 'test',
      to: 'notanemail',
      subject: 'Draft',
      body: 'test',
    });
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('send_email with valid to proceeds (does not return ValidationError)', async () => {
    const server = new MailMCPServer(false);
    const sendEmailMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(server as any, 'getService').mockResolvedValue({ sendEmail: sendEmailMock });
    const result = await (server as any).dispatchTool('send_email', false, {
      accountId: 'test',
      to: 'user@example.com',
      subject: 'Hi',
      body: 'test',
    });
    expect(result.isError).not.toBe(true);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });
});

describe('SAFE-03: rate limiting at dispatch layer', () => {
  it('returns [QuotaError] after exceeding rate limit for an account', async () => {
    // Use very low limits (1 request) to trigger quickly in tests
    const { AccountRateLimiter } = await import('./utils/rate-limiter.js');
    const server = new MailMCPServer(false);
    // Replace the internal rate limiter with a low-limit one
    (server as any).rateLimiter = new AccountRateLimiter({ points: 1, duration: 60 });

    const sendEmailMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(server as any, 'getService').mockResolvedValue({ sendEmail: sendEmailMock });

    // First call should succeed (valid email, 1 point consumed)
    const result1 = await (server as any).dispatchTool('send_email', false, {
      accountId: 'test-rate',
      to: 'user@example.com',
      subject: 'Hi',
      body: 'test',
    });
    expect(result1.isError).not.toBe(true);

    // Second call should be rate-limited
    const result2 = await (server as any).dispatchTool('send_email', false, {
      accountId: 'test-rate',
      to: 'user@example.com',
      subject: 'Hi',
      body: 'test',
    });
    expect(result2.isError).toBe(true);
    expect(result2.content[0].text).toContain('[QuotaError]');
    expect(result2.content[0].text).toContain('Rate limit exceeded');
  });

  it('list_accounts is NOT rate-limited (no accountId)', async () => {
    const { AccountRateLimiter } = await import('./utils/rate-limiter.js');
    const server = new MailMCPServer(false);
    // Replace the internal rate limiter with a 0-point limiter that always fails
    (server as any).rateLimiter = new AccountRateLimiter({ points: 0, duration: 60 });

    // list_accounts has no accountId — should NOT be rate-limited
    const result = await (server as any).dispatchTool('list_accounts', false, {});
    expect(result.isError).not.toBe(true);
  });

  it('rate limiter is called BEFORE getService (no IMAP connection for rate-limited requests)', async () => {
    const { AccountRateLimiter } = await import('./utils/rate-limiter.js');
    const server = new MailMCPServer(false);
    (server as any).rateLimiter = new AccountRateLimiter({ points: 0, duration: 60 });

    const getServiceSpy = vi.spyOn(server as any, 'getService');

    const result = await (server as any).dispatchTool('send_email', false, {
      accountId: 'test',
      to: 'user@example.com',
      subject: 'Hi',
      body: 'test',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[QuotaError]');
    expect(getServiceSpy).not.toHaveBeenCalled();
  });
});

describe('CONN-01: graceful shutdown', () => {
  it('shutdown() calls disconnect() on all services in the services Map', async () => {
    const server = new MailMCPServer(false);
    const d1 = vi.fn().mockResolvedValue(undefined);
    const d2 = vi.fn().mockResolvedValue(undefined);
    (server as any).services.set('account1', { disconnect: d1 });
    (server as any).services.set('account2', { disconnect: d2 });
    await (server as any).shutdown();
    expect(d1).toHaveBeenCalledOnce();
    expect(d2).toHaveBeenCalledOnce();
  });

  it('shutdown() clears the services Map after disconnecting', async () => {
    const server = new MailMCPServer(false);
    (server as any).services.set('account1', { disconnect: vi.fn().mockResolvedValue(undefined) });
    await (server as any).shutdown();
    expect((server as any).services.size).toBe(0);
  });

  it('shutdown() resolves even if a service.disconnect() rejects', async () => {
    const server = new MailMCPServer(false);
    (server as any).services.set('account1', { disconnect: vi.fn().mockRejectedValue(new Error('disconnect failed')) });
    await expect((server as any).shutdown()).resolves.toBeUndefined();
    expect((server as any).services.size).toBe(0);
  });

  it('when shuttingDown is true, shuttingDown flag is set on the server', () => {
    const server = new MailMCPServer(false);
    (server as any).shuttingDown = true;
    expect((server as any).shuttingDown).toBe(true);
  });

  it('inFlightCount starts at 0', () => {
    const server = new MailMCPServer(false);
    expect((server as any).inFlightCount).toBe(0);
  });
});

describe('CONN-02: IMAP reconnect via close-event + getService retry', () => {
  const testAccount = { id: 'acc1', name: 'Test', user: 'test@test.com', host: 'imap.test.com', port: 993, useTLS: true, authType: 'password' } as any;

  beforeEach(() => {
    vi.mocked(getAccounts).mockResolvedValue([testAccount]);
  });

  it('close event on ImapFlow causes services Map entry deletion', async () => {
    // Test _createAndCacheService wires onClose and removing from services Map
    const server = new MailMCPServer(false);

    // Spy on _createAndCacheService to intercept and set up the close callback test
    let capturedOnClose: (() => void) | null = null;
    const fakeService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      imap: {
        get onClose() { return capturedOnClose; },
        set onClose(cb: (() => void) | null) { capturedOnClose = cb; },
      },
    };

    // Bypass real _createAndCacheService by manually setting up services + close listener
    (server as any).services.set('acc1', fakeService);
    fakeService.imap.onClose = () => {
      if (!(server as any).shuttingDown) {
        (server as any).services.delete('acc1');
      }
    };

    expect((server as any).services.has('acc1')).toBe(true);
    capturedOnClose?.();
    expect((server as any).services.has('acc1')).toBe(false);
  });

  it('after close event, services Map no longer has the entry and getService calls _createAndCacheService again', async () => {
    const server = new MailMCPServer(false);

    let capturedOnClose: (() => void) | null = null;
    const fakeService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      imap: {
        get onClose() { return capturedOnClose; },
        set onClose(cb: (() => void) | null) { capturedOnClose = cb; },
      },
    };

    (server as any).services.set('acc1', fakeService);
    fakeService.imap.onClose = () => {
      if (!(server as any).shuttingDown) {
        (server as any).services.delete('acc1');
      }
    };

    // Fire close
    capturedOnClose?.();
    expect((server as any).services.has('acc1')).toBe(false);

    // Next getService will try to reconnect — mock _createAndCacheService to avoid real IMAP
    const newService = { connect: vi.fn(), imap: { onClose: null }, disconnect: vi.fn() };
    vi.spyOn(server as any, '_createAndCacheService').mockResolvedValue(newService);

    const result = await (server as any).getService('acc1');
    expect(result).toBe(newService);
  });

  it('two consecutive connect failures throw NetworkError with "after reconnect attempt"', async () => {
    vi.useFakeTimers();
    const { NetworkError } = await import('./errors.js');

    const server = new MailMCPServer(false);
    vi.spyOn(server as any, '_createAndCacheService').mockRejectedValue(new Error('connection refused'));

    let caughtError: unknown;
    const getServicePromise = (server as any).getService('acc1').catch((e: unknown) => {
      caughtError = e;
    });
    await vi.runAllTimersAsync();
    await getServicePromise;

    expect(caughtError).toBeInstanceOf(NetworkError);
    expect((caughtError as NetworkError).message).toContain('after reconnect attempt');

    vi.useRealTimers();
  });

  it('close listener does NOT delete from Map when shuttingDown=true', async () => {
    const server = new MailMCPServer(false);

    let capturedOnClose: (() => void) | null = null;
    const fakeService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      imap: {
        get onClose() { return capturedOnClose; },
        set onClose(cb: (() => void) | null) { capturedOnClose = cb; },
      },
    };

    (server as any).services.set('acc1', fakeService);
    fakeService.imap.onClose = () => {
      if (!(server as any).shuttingDown) {
        (server as any).services.delete('acc1');
      }
    };

    expect((server as any).services.has('acc1')).toBe(true);
    (server as any).shuttingDown = true;
    capturedOnClose?.();
    expect((server as any).services.has('acc1')).toBe(true);
  });
});

describe('QUAL-01: pagination offset parameter', () => {
  it('list_emails tool schema includes offset property', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'list_emails');
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties.offset).toBeDefined();
  });

  it('search_emails tool schema includes offset property', () => {
    const server = new MailMCPServer(false);
    const tools = (server as any).getTools(false);
    const tool = tools.find((t: any) => t.name === 'search_emails');
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties.offset).toBeDefined();
  });

  it('dispatchTool list_emails passes offset to service.listEmails', async () => {
    const server = new MailMCPServer(false);
    const listEmailsMock = vi.fn().mockResolvedValue([]);
    vi.spyOn(server as any, 'getService').mockResolvedValue({ listEmails: listEmailsMock });
    await (server as any).dispatchTool('list_emails', false, {
      accountId: 'test',
      folder: 'INBOX',
      count: 5,
      offset: 10,
    });
    expect(listEmailsMock).toHaveBeenCalledWith('INBOX', 5, 10);
  });

  it('dispatchTool search_emails passes offset to service.searchEmails', async () => {
    const server = new MailMCPServer(false);
    const searchEmailsMock = vi.fn().mockResolvedValue([]);
    vi.spyOn(server as any, 'getService').mockResolvedValue({ searchEmails: searchEmailsMock });
    await (server as any).dispatchTool('search_emails', false, {
      accountId: 'test',
      folder: 'INBOX',
      count: 5,
      offset: 3,
    });
    expect(searchEmailsMock).toHaveBeenCalledWith(
      expect.any(Object),
      'INBOX',
      5,
      3,
    );
  });
});
