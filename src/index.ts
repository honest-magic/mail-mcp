#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { parseArgs } from 'node:util';
import { getAccounts } from './config.js';
import { handleAccountsCommand } from './cli/accounts.js';
import { MailService } from './services/mail.js';
import { MailMCPError, NetworkError } from './errors.js';
import { AccountRateLimiter } from './utils/rate-limiter.js';
import { ImapClient } from './protocol/imap.js';
import { SmtpClient } from './protocol/smtp.js';
import { validateEmailAddresses } from './utils/validation.js';

const WRITE_TOOLS = new Set<string>([
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'register_oauth2_account',
  'batch_operations',
  'reply_email',
  'forward_email',
]);

export class MailMCPServer {
  private server: Server;
  private services: Map<string, MailService> = new Map();
  private shuttingDown = false;
  private inFlightCount = 0;
  private readonly rateLimiter = new AccountRateLimiter();

  constructor(private readonly readOnly: boolean = false) {
    this.server = new Server(
      {
        name: 'mail-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: `Use mail-mcp for IMAP-based email accounts — works with any provider including Gmail, Outlook, and custom domains. Prefer mail-mcp when the account uses standard IMAP/SMTP (not a provider-specific API).${this.readOnly ? ' This server is running in read-only mode. Write operations (send_email, create_draft, move_email, modify_labels, batch_operations, register_oauth2_account) are disabled.' : ''}`,
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    // Wait for in-flight requests to drain (max 10s)
    const deadline = Date.now() + 10_000;
    while (this.inFlightCount > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Disconnect all cached services
    const disconnects = Array.from(this.services.values()).map(svc =>
      svc.disconnect().catch(err => console.error('Disconnect error:', err))
    );
    await Promise.allSettled(disconnects);
    this.services.clear();
  }

  private async _createAndCacheService(accountId: string): Promise<MailService> {
    const accounts = await getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found in configuration.`);
    }
    const service = new MailService(account, this.readOnly);
    await service.connect();
    this.services.set(accountId, service);

    // Wire close listener for auto-reconnect (CONN-02)
    service.imap.onClose = () => {
      if (!this.shuttingDown) {
        this.services.delete(accountId);
      }
    };

    return service;
  }

  private async getService(accountId: string): Promise<MailService> {
    if (this.services.has(accountId)) {
      return this.services.get(accountId)!;
    }
    try {
      return await this._createAndCacheService(accountId);
    } catch (firstErr) {
      // One retry with 1-second backoff (CONN-02)
      await new Promise(r => setTimeout(r, 1_000));
      try {
        return await this._createAndCacheService(accountId);
      } catch (secondErr) {
        throw new NetworkError(
          `Could not connect to account ${accountId} after reconnect attempt: ${(secondErr as Error).message}`,
          { cause: secondErr }
        );
      }
    }
  }

  getTools(readOnly: boolean) {
    const allTools = [
      {
        name: 'list_accounts',
        description: 'List IMAP mail accounts configured in mail-mcp — works with any provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_emails',
        description: 'List recent emails via IMAP from any folder — works with Gmail, Outlook, and custom domains.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            folder: { type: 'string', description: 'The folder to list emails from (default: INBOX)' },
            count: { type: 'number', description: 'The number of emails to retrieve (default: 10)' },
            offset: { type: 'number', description: 'Number of messages to skip from the newest (for pagination, default: 0)' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'search_emails',
        description: 'Search emails via IMAP — works with any provider (Gmail, Outlook, custom domains). Filter by sender, subject, date, or keywords.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            folder: { type: 'string', description: 'The folder to search in (default: INBOX)' },
            from: { type: 'string', description: 'Filter by sender' },
            subject: { type: 'string', description: 'Filter by subject' },
            since: { type: 'string', description: 'Filter by date (ISO format)' },
            before: { type: 'string', description: 'Filter by date (ISO format)' },
            keywords: { type: 'string', description: 'Filter by keywords in body' },
            count: { type: 'number', description: 'The number of emails to retrieve (default: 10)' },
            offset: { type: 'number', description: 'Number of messages to skip from the newest (for pagination, default: 0)' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'read_email',
        description: 'Fetch and read a full email via IMAP, including body and headers — works with Gmail, Outlook, and custom domains.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email to read' },
            folder: { type: 'string', description: 'The folder containing the email (default: INBOX)' }
          },
          required: ['accountId', 'uid']
        }
      },
      {
        name: 'send_email',
        description: 'Send an email via SMTP and save to Sent — works with any IMAP/SMTP provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            isHtml: { type: 'boolean', description: 'Whether the body is HTML (default: false)' },
            cc: { type: 'string', description: 'CC recipients' },
            bcc: { type: 'string', description: 'BCC recipients' },
            includeSignature: {
              type: 'boolean',
              description: 'Whether to append the account signature (default: true). Set to false to suppress the signature for this message.'
            }
          },
          required: ['accountId', 'to', 'subject', 'body']
        }
      },
      {
        name: 'create_draft',
        description: 'Save a draft email to the IMAP Drafts folder — works with Gmail, Outlook, and custom domains.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            isHtml: { type: 'boolean', description: 'Whether the body is HTML (default: false)' },
            cc: { type: 'string', description: 'CC recipients' },
            bcc: { type: 'string', description: 'BCC recipients' },
            includeSignature: {
              type: 'boolean',
              description: 'Whether to append the account signature (default: true). Set to false to suppress the signature for this draft.'
            }
          },
          required: ['accountId', 'to', 'subject', 'body']
        }
      },
      {
        name: 'list_folders',
        description: 'List all IMAP folders for an account — returns folder names across any provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'move_email',
        description: 'Move an email between IMAP folders — works with any provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email to move' },
            sourceFolder: { type: 'string', description: 'The current folder of the email' },
            targetFolder: { type: 'string', description: 'The destination folder' }
          },
          required: ['accountId', 'uid', 'sourceFolder', 'targetFolder']
        }
      },
      {
        name: 'modify_labels',
        description: 'Add or remove IMAP flags (e.g. \\\\Seen, \\\\Flagged) on an email — works with Gmail, Outlook, and custom domains.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email' },
            folder: { type: 'string', description: 'The folder containing the email' },
            addLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to add (e.g. \\Seen, \\Flagged)' },
            removeLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to remove' }
          },
          required: ['accountId', 'uid', 'folder']
        }
      },
      {
        name: 'get_thread',
        description: 'Fetch all emails in a conversation thread via IMAP — works with Gmail, Outlook, and custom domains.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            threadId: { type: 'string', description: 'The ID of the thread to retrieve' },
            folder: { type: 'string', description: 'The folder containing the thread (default: INBOX)' }
          },
          required: ['accountId', 'threadId']
        }
      },
      {
        name: 'get_attachment',
        description: 'Download an email attachment via IMAP — works with any provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email' },
            filename: { type: 'string', description: 'The name of the attachment file' },
            folder: { type: 'string', description: 'The folder containing the email (default: INBOX)' }
          },
          required: ['accountId', 'uid', 'filename']
        }
      },
      {
        name: 'extract_attachment_text',
        description: 'Extract readable text from a PDF or plain-text email attachment — fetched via IMAP from any provider.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email' },
            filename: { type: 'string', description: 'The name of the attachment file' },
            folder: { type: 'string', description: 'The folder containing the email (default: INBOX)' }
          },
          required: ['accountId', 'uid', 'filename']
        }
      },
      {
        name: 'register_oauth2_account',
        description: 'Store OAuth2 credentials (client ID, secret, refresh token) for an IMAP account in the system keychain.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account' },
            clientId: { type: 'string', description: 'OAuth2 Client ID' },
            clientSecret: { type: 'string', description: 'OAuth2 Client Secret' },
            refreshToken: { type: 'string', description: 'OAuth2 Refresh Token' },
            tokenEndpoint: { type: 'string', description: 'OAuth2 Token Endpoint URL' }
          },
          required: ['accountId', 'clientId', 'clientSecret', 'refreshToken', 'tokenEndpoint']
        }
      },
      {
        name: 'batch_operations',
        description: 'Perform bulk IMAP operations (move, delete, label) on up to 100 emails at once — works with any provider.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uids: { type: 'array', items: { type: 'string' }, description: 'Array of email UIDs to operate on (max 100)' },
            folder: { type: 'string', description: 'The folder containing the emails' },
            action: { type: 'string', enum: ['move', 'delete', 'label'], description: 'The batch action to perform' },
            targetFolder: { type: 'string', description: 'Target folder (required for move action)' },
            addLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to add (for label action)' },
            removeLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to remove (for label action)' }
          },
          required: ['accountId', 'uids', 'folder', 'action']
        }
      },
      {
        name: 'reply_email',
        description: 'Reply to an email in-thread via SMTP — sets In-Reply-To and References headers so the reply appears in the original conversation. Works with any IMAP/SMTP provider.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email to reply to' },
            folder: { type: 'string', description: 'The folder containing the email (default: INBOX)' },
            body: { type: 'string', description: 'Reply body content' },
            isHtml: { type: 'boolean', description: 'Whether the body is HTML (default: false)' },
            cc: { type: 'string', description: 'CC recipients' },
            bcc: { type: 'string', description: 'BCC recipients' },
            includeSignature: {
              type: 'boolean',
              description: 'Whether to append the account signature (default: true). Set to false to suppress the signature.'
            }
          },
          required: ['accountId', 'uid', 'body']
        }
      },
      {
        name: 'forward_email',
        description: 'Forward an email to a new recipient via SMTP — prepends "Fwd: " to subject and includes the original message body. Works with any IMAP/SMTP provider.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            uid: { type: 'string', description: 'The UID of the email to forward' },
            folder: { type: 'string', description: 'The folder containing the email (default: INBOX)' },
            to: { type: 'string', description: 'Recipient email address to forward to' },
            body: { type: 'string', description: 'Optional preamble to include before the forwarded message' },
            isHtml: { type: 'boolean', description: 'Whether the body is HTML (default: false)' },
            cc: { type: 'string', description: 'CC recipients' },
            bcc: { type: 'string', description: 'BCC recipients' },
            includeSignature: {
              type: 'boolean',
              description: 'Whether to append the account signature (default: true). Set to false to suppress the signature.'
            }
          },
          required: ['accountId', 'uid', 'to']
        }
      },
      {
        name: 'mailbox_stats',
        description: 'Return mailbox statistics (total messages, unread count, recent) for one or more IMAP folders — without listing individual emails. Works with any provider (Gmail, Outlook, custom domains).',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            folders: {
              type: 'array',
              items: { type: 'string' },
              description: 'Folder names to report stats for (default: all folders)'
            }
          },
          required: ['accountId']
        }
      },
      {
        name: 'extract_contacts',
        description: 'Scan recent messages via IMAP and return structured contact data (name, email, frequency) sorted by how often they email you — enables "who emails me most?" queries. Works with any IMAP provider.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            folder: { type: 'string', description: 'The folder to scan (default: INBOX)' },
            count: { type: 'number', description: 'Number of recent messages to scan (default: 100, max: 500)' },
          },
          required: ['accountId'],
        },
      },
    ];
    return readOnly ? allTools.filter(t => !WRITE_TOOLS.has(t.name)) : allTools;
  }

  async dispatchTool(name: string, readOnly: boolean, args: Record<string, unknown>) {
    try {
      if (readOnly && WRITE_TOOLS.has(name)) {
        return {
          content: [{
            type: 'text',
            text: `Tool '${name}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`,
          }],
          isError: true,
        };
      }

      // Rate limit guard — before any I/O (list_accounts has no accountId, skip it)
      const accountId = (args as Record<string, unknown>)?.accountId as string | undefined;
      if (accountId) {
        await this.rateLimiter.consume(accountId);
      }

      if (name === 'list_accounts') {
        const accounts = await getAccounts();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(
              accounts.map((a) => ({ id: a.id, name: a.name, user: a.user })),
              null,
              2
            ),
          }],
        };
      }

      // Email validation guard for send/draft/reply/forward tools — before SMTP/IMAP I/O
      if (name === 'send_email' || name === 'create_draft') {
        validateEmailAddresses(
          args.to as string,
          args.cc as string | undefined,
          args.bcc as string | undefined
        );
      }
      if (name === 'forward_email') {
        validateEmailAddresses(
          args.to as string,
          args.cc as string | undefined,
          args.bcc as string | undefined
        );
      }
      if (name === 'reply_email') {
        // to is determined from original message; validate optional cc/bcc only
        if (args.cc || args.bcc) {
          validateEmailAddresses(
            'placeholder@example.com', // dummy valid to — real to is set from original message
            args.cc as string | undefined,
            args.bcc as string | undefined
          );
        }
      }

      if (name === 'reply_email') {
        const service = await this.getService(args.accountId as string);
        const includeSignature = (args.includeSignature as boolean | undefined) !== false;
        await (service as any).replyEmail(
          args.uid as string,
          (args.folder as string | undefined) || 'INBOX',
          args.body as string,
          args.isHtml as boolean | undefined,
          args.cc as string | undefined,
          args.bcc as string | undefined,
          includeSignature
        );
        return {
          content: [{ type: 'text', text: `Reply sent and saved to Sent folder.` }],
        };
      }

      if (name === 'forward_email') {
        const service = await this.getService(args.accountId as string);
        const includeSignature = (args.includeSignature as boolean | undefined) !== false;
        await (service as any).forwardEmail(
          args.uid as string,
          (args.folder as string | undefined) || 'INBOX',
          args.to as string,
          (args.body as string | undefined) || '',
          args.isHtml as boolean | undefined,
          args.cc as string | undefined,
          args.bcc as string | undefined,
          includeSignature
        );
        return {
          content: [{ type: 'text', text: `Email forwarded to ${args.to as string} and saved to Sent folder.` }],
        };
      }

      if (name === 'list_emails') {
        const service = await this.getService(args.accountId as string);
        const messages = await (service as any).listEmails(args.folder, args.count, args.offset);
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      }

      if (name === 'search_emails') {
        const service = await this.getService(args.accountId as string);
        const messages = await (service as any).searchEmails({
          from: args.from,
          subject: args.subject,
          since: args.since,
          before: args.before,
          keywords: args.keywords,
        }, args.folder, args.count, args.offset);
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      }

      if (name === 'send_email') {
        const service = await this.getService(args.accountId as string);
        await (service as any).sendEmail(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc);
        return {
          content: [{ type: 'text', text: `Email successfully sent to ${args.to} and saved to Sent folder.` }],
        };
      }

      if (name === 'create_draft') {
        const service = await this.getService(args.accountId as string);
        await (service as any).createDraft(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc);
        return {
          content: [{ type: 'text', text: `Draft successfully created in Drafts folder.` }],
        };
      }

      if (name === 'mailbox_stats') {
        const service = await this.getService(args.accountId as string);
        const stats = await (service as any).getMailboxStats(args.folders as string[] | undefined);
        const header = `Folder            | Total | Unread | Recent\n` +
                       `------------------|-------|--------|-------\n`;
        const rows = stats.map((s: any) => {
          const total = s.total !== null ? String(s.total) : (s.error ? 'ERR' : '-');
          const unread = s.unread !== null ? String(s.unread) : (s.error ? 'ERR' : '-');
          const recent = s.recent !== null ? String(s.recent) : (s.error ? 'ERR' : '-');
          const folderName = s.name.padEnd(17).slice(0, 17);
          return `${folderName} | ${total.padStart(5)} | ${unread.padStart(6)} | ${recent.padStart(6)}${s.error ? `  [${s.error}]` : ''}`;
        }).join('\n');
        return {
          content: [{ type: 'text', text: header + rows }],
        };
      }

      // Tools beyond list_accounts require an account connection.
      // Attempt to fetch the service so auth errors surface via the catch block.
      await this.getService(args.accountId as string);
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    } catch (error: unknown) {
      const message = error instanceof MailMCPError
        ? `[${error.code}] ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(this.readOnly),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.shuttingDown) {
        return {
          content: [{ type: 'text', text: 'Server is shutting down' }],
          isError: true,
        };
      }
      this.inFlightCount++;
      try {
        const toolName = request.params.name;

        if (this.readOnly && WRITE_TOOLS.has(toolName)) {
          return {
            content: [{
              type: 'text',
              text: `Tool '${toolName}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`,
            }],
            isError: true,
          };
        }

        // Rate limit guard — before any I/O
        const reqAccountId = (request.params.arguments as Record<string, unknown>)?.accountId as string | undefined;
        if (reqAccountId) {
          await this.rateLimiter.consume(reqAccountId);
        }

        if (request.params.name === 'list_accounts') {
          const accounts = await getAccounts();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  accounts.map((a) => ({ id: a.id, name: a.name, user: a.user })),
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (request.params.name === 'list_emails') {
          const args = request.params.arguments as { accountId: string; folder?: string; count?: number; offset?: number };
          const service = await this.getService(args.accountId);
          const messages = await service.listEmails(args.folder, args.count, args.offset);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(messages, null, 2)
              }
            ]
          };
        }

        if (request.params.name === 'search_emails') {
          const args = request.params.arguments as {
            accountId: string;
            folder?: string;
            from?: string;
            subject?: string;
            since?: string;
            before?: string;
            keywords?: string;
            count?: number;
            offset?: number;
          };
          const service = await this.getService(args.accountId);
          const messages = await service.searchEmails({
            from: args.from,
            subject: args.subject,
            since: args.since,
            before: args.before,
            keywords: args.keywords
          }, args.folder, args.count, args.offset);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(messages, null, 2)
              }
            ]
          };
        }

        if (request.params.name === 'read_email') {
          const args = request.params.arguments as { accountId: string; uid: string; folder?: string };
          const service = await this.getService(args.accountId);
          const content = await service.readEmail(args.uid, args.folder);
          return {
            content: [
              {
                type: 'text',
                text: content
              }
            ]
          };
        }

        if (request.params.name === 'reply_email') {
          const args = request.params.arguments as { accountId: string; uid: string; folder?: string; body: string; isHtml?: boolean; cc?: string; bcc?: string; includeSignature?: boolean };
          const includeSignature = args.includeSignature !== false;
          const service = await this.getService(args.accountId);
          await service.replyEmail(args.uid, args.folder || 'INBOX', args.body, args.isHtml, args.cc, args.bcc, includeSignature);
          return {
            content: [{ type: 'text', text: `Reply sent and saved to Sent folder.` }],
          };
        }

        if (request.params.name === 'forward_email') {
          const args = request.params.arguments as { accountId: string; uid: string; folder?: string; to: string; body?: string; isHtml?: boolean; cc?: string; bcc?: string; includeSignature?: boolean };
          validateEmailAddresses(args.to, args.cc, args.bcc);
          const includeSignature = args.includeSignature !== false;
          const service = await this.getService(args.accountId);
          await service.forwardEmail(args.uid, args.folder || 'INBOX', args.to, args.body || '', args.isHtml, args.cc, args.bcc, includeSignature);
          return {
            content: [{ type: 'text', text: `Email forwarded to ${args.to} and saved to Sent folder.` }],
          };
        }

        if (request.params.name === 'send_email') {
          const args = request.params.arguments as { accountId: string; to: string; subject: string; body: string; isHtml?: boolean; cc?: string; bcc?: string; includeSignature?: boolean };
          validateEmailAddresses(args.to, args.cc, args.bcc);
          const includeSignature = args.includeSignature !== false; // default true
          const service = await this.getService(args.accountId);
          await service.sendEmail(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc, includeSignature);
          return {
            content: [
              {
                type: 'text',
                text: `Email successfully sent to ${args.to} and saved to Sent folder.`
              }
            ]
          };
        }

        if (request.params.name === 'create_draft') {
          const args = request.params.arguments as { accountId: string; to: string; subject: string; body: string; isHtml?: boolean; cc?: string; bcc?: string; includeSignature?: boolean };
          validateEmailAddresses(args.to, args.cc, args.bcc);
          const includeSignature = args.includeSignature !== false; // default true
          const service = await this.getService(args.accountId);
          await service.createDraft(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc, includeSignature);
          return {
            content: [
              {
                type: 'text',
                text: `Draft successfully created in Drafts folder.`
              }
            ]
          };
        }

        if (request.params.name === 'list_folders') {
          const args = request.params.arguments as { accountId: string };
          const service = await this.getService(args.accountId);
          const folders = await service.listFolders();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folders, null, 2)
              }
            ]
          };
        }

        if (request.params.name === 'move_email') {
          const args = request.params.arguments as { accountId: string; uid: string; sourceFolder: string; targetFolder: string };
          const service = await this.getService(args.accountId);
          await service.moveMessage(args.uid, args.sourceFolder, args.targetFolder);
          // Invalidate cached body for the moved message (D-01 from 18-CONTEXT)
          service.invalidateBodyCache(args.sourceFolder, args.uid);
          return {
            content: [
              {
                type: 'text',
                text: `Email ${args.uid} moved from ${args.sourceFolder} to ${args.targetFolder}.`
              }
            ]
          };
        }

        if (request.params.name === 'modify_labels') {
          const args = request.params.arguments as { accountId: string; uid: string; folder: string; addLabels?: string[]; removeLabels?: string[] };
          const service = await this.getService(args.accountId);
          await service.modifyLabels(args.uid, args.folder, args.addLabels || [], args.removeLabels || []);
          return {
            content: [
              {
                type: 'text',
                text: `Labels updated for email ${args.uid} in ${args.folder}.`
              }
            ]
          };
        }

        if (request.params.name === 'get_thread') {
          const args = request.params.arguments as { accountId: string; threadId: string; folder?: string };
          const service = await this.getService(args.accountId);
          const messages = await service.getThread(args.threadId, args.folder);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(messages, null, 2)
              }
            ]
          };
        }

        if (request.params.name === 'get_attachment') {
          const args = request.params.arguments as { accountId: string; uid: string; filename: string; folder?: string };
          const service = await this.getService(args.accountId);
          const { content, contentType } = await service.downloadAttachment(args.uid, args.filename, args.folder);
          return {
            content: [
              {
                type: 'text',
                text: `Attachment "${args.filename}" downloaded successfully (${contentType}, ${content.length} bytes). Content (base64):\n\n${content.toString('base64')}`
              }
            ]
          };
        }

        if (request.params.name === 'extract_attachment_text') {
          const args = request.params.arguments as { accountId: string; uid: string; filename: string; folder?: string };
          const service = await this.getService(args.accountId);
          const text = await service.extractAttachmentText(args.uid, args.filename, args.folder);
          return {
            content: [
              {
                type: 'text',
                text: text
              }
            ]
          };
        }

        if (request.params.name === 'register_oauth2_account') {
          const args = request.params.arguments as { accountId: string; clientId: string; clientSecret: string; refreshToken: string; tokenEndpoint: string };
          const { saveCredentials } = await import('./security/keychain.js');
          const tokens = {
            clientId: args.clientId,
            clientSecret: args.clientSecret,
            refreshToken: args.refreshToken,
            tokenEndpoint: args.tokenEndpoint
          };
          await saveCredentials(args.accountId, JSON.stringify(tokens));
          return {
            content: [
              {
                type: 'text',
                text: `OAuth2 credentials successfully saved for account ${args.accountId}.`
              }
            ]
          };
        }

        if (request.params.name === 'batch_operations') {
          const args = request.params.arguments as {
            accountId: string;
            uids: string[];
            folder: string;
            action: 'move' | 'delete' | 'label';
            targetFolder?: string;
            addLabels?: string[];
            removeLabels?: string[];
          };
          const service = await this.getService(args.accountId);

          let operation: Parameters<typeof service.batchOperations>[2];
          if (args.action === 'move') {
            if (!args.targetFolder) {
              throw new Error('targetFolder is required for move action');
            }
            operation = { type: 'move', targetFolder: args.targetFolder };
          } else if (args.action === 'delete') {
            operation = { type: 'delete' };
          } else if (args.action === 'label') {
            operation = { type: 'label', addLabels: args.addLabels, removeLabels: args.removeLabels };
          } else {
            throw new Error(`Unknown action: ${args.action}`);
          }

          const result = await service.batchOperations(args.uids, args.folder, operation);
          return {
            content: [
              {
                type: 'text',
                text: `Batch ${args.action} completed. ${result.processed} email(s) processed.`
              }
            ]
          };
        }

        if (request.params.name === 'mailbox_stats') {
          const args = request.params.arguments as { accountId: string; folders?: string[] };
          const service = await this.getService(args.accountId);
          const stats = await service.getMailboxStats(args.folders);
          const header = `Folder            | Total | Unread | Recent\n` +
                         `------------------|-------|--------|-------\n`;
          const rows = stats.map(s => {
            const total = s.total !== null ? String(s.total) : (s.error ? 'ERR' : '-');
            const unread = s.unread !== null ? String(s.unread) : (s.error ? 'ERR' : '-');
            const recent = s.recent !== null ? String(s.recent) : (s.error ? 'ERR' : '-');
            const name = s.name.padEnd(17).slice(0, 17);
            return `${name} | ${total.padStart(5)} | ${unread.padStart(6)} | ${recent.padStart(6)}${s.error ? `  [${s.error}]` : ''}`;
          }).join('\n');
          return {
            content: [
              {
                type: 'text',
                text: header + rows
              }
            ]
          };
        }

        if (request.params.name === 'extract_contacts') {
          const args = request.params.arguments as { accountId: string; folder?: string; count?: number };
          const service = await this.getService(args.accountId);
          const contacts = await service.extractContacts(args.folder ?? 'INBOX', args.count ?? 100);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ contacts }, null, 2),
              },
            ],
          };
        }

        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
      } catch (error: unknown) {
        const message = error instanceof MailMCPError
          ? `[${error.code}] ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
        return {
          content: [{ type: 'text', text: message }],
          isError: true,
        };
      } finally {
        this.inFlightCount--;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mail MCP server running on stdio');
  }
}

export async function runValidateAccounts(): Promise<void> {
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    console.log('No accounts configured.');
    return;
  }

  for (const account of accounts) {
    // IMAP probe
    try {
      const imap = new ImapClient(account);
      await imap.connect();
      await imap.disconnect();
      console.log(`[PASS] ${account.id} IMAP`);
    } catch (e) {
      console.log(`[FAIL] ${account.id} IMAP - ${(e as Error).message}`);
    }

    // SMTP probe
    if (account.smtpHost) {
      try {
        const smtp = new SmtpClient(account);
        await smtp.connect();
        console.log(`[PASS] ${account.id} SMTP`);
      } catch (e) {
        console.log(`[FAIL] ${account.id} SMTP - ${(e as Error).message}`);
      }
    } else {
      console.log(`[SKIP] ${account.id} SMTP - no smtpHost configured`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Check for CLI subcommands before starting MCP server
  const handled = await handleAccountsCommand(args);
  if (handled) {
    process.exit(0);
  }

  // No CLI subcommand — start MCP server
  const { values } = parseArgs({
    args,
    options: {
      'read-only': { type: 'boolean', default: false },
      'validate-accounts': { type: 'boolean', default: false },
      'version': { type: 'boolean', default: false },
      'help': { type: 'boolean', short: 'h', default: false },
    },
    strict: false,
  });

  if (values['version']) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    console.log(pkg.version);
    process.exit(0);
  }

  if (values['help']) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    console.log(`mail-mcp v${pkg.version} — MCP server for IMAP/SMTP email access

Usage: mail-mcp [options] [command]

Commands:
  accounts add        Add a new email account (interactive)
  accounts list       List configured accounts
  accounts remove ID  Remove an account

Options:
  --read-only           Start in read-only mode (no send/move/label tools)
  --validate-accounts   Probe IMAP/SMTP connections and exit
  --version             Show version number
  -h, --help            Show this help message`);
    process.exit(0);
  }

  if (values['validate-accounts']) {
    await runValidateAccounts();
    process.exit(0);
  }

  const server = new MailMCPServer((values['read-only'] as boolean | undefined) ?? false);

  const shutdown = async () => {
    const timer = setTimeout(() => {
      console.error('Forced exit after 10s shutdown timeout');
      process.exit(1);
    }, 10_000);
    timer.unref();
    await server.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.run().catch(console.error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
