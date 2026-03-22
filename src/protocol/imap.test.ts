import { describe, it, expect, vi } from 'vitest';
import { ImapClient } from './imap.js';
import { EmailAccount } from '../types/index.js';

vi.mock('../security/keychain.js', () => ({
  loadCredentials: vi.fn(() => Promise.resolve('test-password'))
}));

vi.mock('imapflow', () => {
  return {
    ImapFlow: vi.fn().mockImplementation(function() {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        getMailboxLock: vi.fn().mockResolvedValue({
          release: vi.fn()
        }),
        fetch: vi.fn().mockImplementation(async function* () {
          yield {
            uid: 1,
            envelope: {
              subject: 'Test Subject',
              from: [{ address: 'test@example.com' }],
              date: new Date()
            },
            internalDate: new Date(),
            threadId: '123'
          };
        }),
        fetchOne: vi.fn().mockResolvedValue({
          source: Buffer.from('Email Source'),
          internalDate: new Date()
        }),
        search: vi.fn().mockResolvedValue([1]),
        list: vi.fn().mockResolvedValue([
          { path: 'INBOX' },
          { path: 'Sent' },
          { path: 'Drafts' },
          { path: 'Trash' }
        ]),
        messageMove: vi.fn().mockResolvedValue(undefined),
        messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
        messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
        messageDelete: vi.fn().mockResolvedValue(undefined),
        mailbox: {
          exists: 1
        }
      };
    })
  };
});

describe('ImapClient', () => {
  const account: EmailAccount = {
    id: 'test-account',
    name: 'Test',
    host: 'imap.test.com',
    port: 993,
    user: 'test@test.com',
    authType: 'login',
    useTLS: true
  };

  it('should connect to the IMAP server', async () => {
    const client = new ImapClient(account);
    await client.connect();
    expect(client).toBeDefined();
  });

  it('should list messages', async () => {
    const client = new ImapClient(account);
    await client.connect();
    const messages = await client.listMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].subject).toBe('Test Subject');
  });

  it('should fetch message body', async () => {
    const client = new ImapClient(account);
    await client.connect();
    const body = await client.fetchMessageBody('1');
    expect(body.headerLines[0].line).toBe('Email Source');
  });

  it('should fetch thread messages', async () => {
    const client = new ImapClient(account);
    await client.connect();
    const messages = await client.fetchThreadMessages('123');
    expect(messages).toHaveLength(1);
    expect(messages[0].threadId).toBe('123');
  });

  it('should search messages with criteria', async () => {
    const client = new ImapClient(account);
    await client.connect();
    const messages = await client.searchMessages({ from: 'sender@example.com', subject: 'Test' });
    expect(messages).toHaveLength(1);
    expect(messages[0].uid).toBe(1);
  });

  describe('IMAP-04: listFolders', () => {
    it('should list folders returning an array of path strings', async () => {
      const client = new ImapClient(account);
      await client.connect();
      const folders = await client.listFolders();
      expect(folders).toEqual(['INBOX', 'Sent', 'Drafts', 'Trash']);
    });
  });

  describe('ORG-01: moveMessage', () => {
    it('should call messageMove with correct uid and target folder', async () => {
      const { ImapFlow } = await import('imapflow');
      const instance = (ImapFlow as any).mock.results.at(-1)?.value;
      const client = new ImapClient(account);
      await client.connect();
      await client.moveMessage('5', 'INBOX', 'Archive');
      const latestInstance = (ImapFlow as any).mock.results.at(-1)?.value;
      expect(latestInstance.messageMove).toHaveBeenCalledWith('5', 'Archive', { uid: true });
    });
  });

  describe('ORG-02: modifyLabels', () => {
    it('should call messageFlagsAdd when addLabels provided', async () => {
      const { ImapFlow } = await import('imapflow');
      const client = new ImapClient(account);
      await client.connect();
      await client.modifyLabels('5', 'INBOX', ['\\Flagged'], []);
      const latestInstance = (ImapFlow as any).mock.results.at(-1)?.value;
      expect(latestInstance.messageFlagsAdd).toHaveBeenCalledWith('5', ['\\Flagged'], { uid: true });
    });

    it('should call messageFlagsRemove when removeLabels provided', async () => {
      const { ImapFlow } = await import('imapflow');
      const client = new ImapClient(account);
      await client.connect();
      await client.modifyLabels('5', 'INBOX', [], ['\\Seen']);
      const latestInstance = (ImapFlow as any).mock.results.at(-1)?.value;
      expect(latestInstance.messageFlagsRemove).toHaveBeenCalledWith('5', ['\\Seen'], { uid: true });
    });

    it('should call both add and remove when both lists are non-empty', async () => {
      const { ImapFlow } = await import('imapflow');
      const client = new ImapClient(account);
      await client.connect();
      await client.modifyLabels('5', 'INBOX', ['\\Flagged'], ['\\Seen']);
      const latestInstance = (ImapFlow as any).mock.results.at(-1)?.value;
      expect(latestInstance.messageFlagsAdd).toHaveBeenCalledWith('5', ['\\Flagged'], { uid: true });
      expect(latestInstance.messageFlagsRemove).toHaveBeenCalledWith('5', ['\\Seen'], { uid: true });
    });
  });

  it('should return empty array when search finds no messages', async () => {
    const { ImapFlow } = await import('imapflow');
    const MockImapFlow = ImapFlow as any;
    MockImapFlow.mockImplementationOnce(function() {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
        search: vi.fn().mockResolvedValue([]),
        fetch: vi.fn().mockImplementation(async function* () {}),
        mailbox: { exists: 0 }
      };
    });
    const emptyClient = new ImapClient(account);
    await emptyClient.connect();
    const messages = await emptyClient.searchMessages({ from: 'nobody@example.com' });
    expect(messages).toHaveLength(0);
  });

  describe('disconnect() liveness check', () => {
    it('calls logout() when client exists and client.usable is true', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      const logoutMock = vi.fn().mockResolvedValue(undefined);
      MockImapFlow.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          logout: logoutMock,
          usable: true,
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetch: vi.fn().mockImplementation(async function* () {}),
          mailbox: { exists: 0 }
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      await client.disconnect();
      expect(logoutMock).toHaveBeenCalledOnce();
    });

    it('does NOT call logout() when client exists but client.usable is false', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      const logoutMock = vi.fn().mockResolvedValue(undefined);
      MockImapFlow.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          logout: logoutMock,
          usable: false,
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetch: vi.fn().mockImplementation(async function* () {}),
          mailbox: { exists: 0 }
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      await client.disconnect();
      expect(logoutMock).not.toHaveBeenCalled();
    });

    it('sets this.client to null after successful logout', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          logout: vi.fn().mockResolvedValue(undefined),
          usable: true,
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetch: vi.fn().mockImplementation(async function* () {}),
          mailbox: { exists: 0 }
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      await client.disconnect();
      expect((client as any).client).toBeNull();
    });

    it('sets this.client to null even when client.usable is false (cleanup)', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          logout: vi.fn().mockResolvedValue(undefined),
          usable: false,
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetch: vi.fn().mockImplementation(async function* () {}),
          mailbox: { exists: 0 }
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      await client.disconnect();
      expect((client as any).client).toBeNull();
    });

    it('does nothing when client is null (no throw)', async () => {
      const client = new ImapClient(account);
      // client is null since we never called connect()
      await expect(client.disconnect()).resolves.toBeUndefined();
      expect((client as any).client).toBeNull();
    });
  });

  describe('fetchAttachmentSize', () => {
    it('returns size when bodyStructure has part matching parameters.name', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      const mockRelease = vi.fn();
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: mockRelease }),
          fetchOne: vi.fn().mockResolvedValue({
            bodyStructure: {
              parameters: { name: 'report.pdf' },
              size: 1000,
              childNodes: [],
            },
          }),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'report.pdf');
      expect(size).toBe(1000);
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it('returns size when bodyStructure has part matching dispositionParameters.filename', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetchOne: vi.fn().mockResolvedValue({
            bodyStructure: {
              dispositionParameters: { filename: 'report.pdf' },
              size: 2000,
              childNodes: [],
            },
          }),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'report.pdf');
      expect(size).toBe(2000);
    });

    it('returns correct size when matching part is nested in childNodes', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetchOne: vi.fn().mockResolvedValue({
            bodyStructure: {
              childNodes: [
                {
                  childNodes: [
                    {
                      parameters: { name: 'nested.pdf' },
                      size: 5000,
                      childNodes: [],
                    },
                  ],
                },
              ],
            },
          }),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'nested.pdf');
      expect(size).toBe(5000);
    });

    it('returns null when no part matches the filename', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetchOne: vi.fn().mockResolvedValue({
            bodyStructure: {
              parameters: { name: 'other.pdf' },
              size: 999,
              childNodes: [],
            },
          }),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'report.pdf');
      expect(size).toBeNull();
    });

    it('returns null when msg.bodyStructure is undefined', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetchOne: vi.fn().mockResolvedValue({ bodyStructure: undefined }),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'report.pdf');
      expect(size).toBeNull();
    });

    it('returns null when fetchOne returns null', async () => {
      const { ImapFlow } = await import('imapflow');
      const MockImapFlow = ImapFlow as any;
      MockImapFlow.mockImplementationOnce(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
          fetchOne: vi.fn().mockResolvedValue(null),
        };
      });
      const client = new ImapClient(account);
      await client.connect();
      const size = await client.fetchAttachmentSize('1', 'report.pdf');
      expect(size).toBeNull();
    });
  });
});
