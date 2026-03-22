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
import { MailService } from './services/mail.js';

const WRITE_TOOLS = new Set<string>([
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'register_oauth2_account',
  'batch_operations',
]);

export class MailMCPServer {
  private server: Server;
  private services: Map<string, MailService> = new Map();

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
        ...(this.readOnly ? {
          instructions: 'This server is running in read-only mode. Write operations (send_email, create_draft, move_email, modify_labels, batch_operations, register_oauth2_account) are disabled.',
        } : {}),
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  private async getService(accountId: string): Promise<MailService> {
    if (this.services.has(accountId)) {
      return this.services.get(accountId)!;
    }
    const accounts = getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found in configuration.`);
    }
    const service = new MailService(account, this.readOnly);
    await service.connect();
    this.services.set(accountId, service);
    return service;
  }

  getTools(readOnly: boolean) {
    const allTools = [
      {
        name: 'list_accounts',
        description: 'List configured mail accounts',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_emails',
        description: 'List recent emails from a specific folder',
        annotations: { readOnlyHint: true, destructiveHint: false },
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'The ID of the account to use' },
            folder: { type: 'string', description: 'The folder to list emails from (default: INBOX)' },
            count: { type: 'number', description: 'The number of emails to retrieve (default: 10)' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'search_emails',
        description: 'Search for emails based on various criteria',
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
            count: { type: 'number', description: 'The number of emails to retrieve (default: 10)' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'read_email',
        description: 'Read the content of a specific email',
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
        description: 'Send an email and save it to the Sent folder',
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
            bcc: { type: 'string', description: 'BCC recipients' }
          },
          required: ['accountId', 'to', 'subject', 'body']
        }
      },
      {
        name: 'create_draft',
        description: 'Create a draft email in the Drafts folder',
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
            bcc: { type: 'string', description: 'BCC recipients' }
          },
          required: ['accountId', 'to', 'subject', 'body']
        }
      },
      {
        name: 'list_folders',
        description: 'List all available IMAP folders',
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
        description: 'Move an email from one folder to another',
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
        description: 'Add or remove IMAP flags/labels on an email',
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
        description: 'Get all emails in a specific conversation/thread',
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
        description: 'Download an attachment from a specific email',
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
        description: 'Extract text content from a PDF or text attachment',
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
        description: 'Store OAuth2 credentials for an account in the keychain',
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
        description: 'Perform batch operations (move, delete, label) on multiple emails',
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
    ];
    return readOnly ? allTools.filter(t => !WRITE_TOOLS.has(t.name)) : allTools;
  }

  async dispatchTool(name: string, readOnly: boolean, args: Record<string, unknown>) {
    if (readOnly && WRITE_TOOLS.has(name)) {
      return {
        content: [{
          type: 'text',
          text: `Tool '${name}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`,
        }],
        isError: true,
      };
    }

    if (name === 'list_accounts') {
      const accounts = getAccounts();
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

    // For test purposes — other tools require a real service connection
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(this.readOnly),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

        if (request.params.name === 'list_accounts') {
          const accounts = getAccounts();
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
          const args = request.params.arguments as { accountId: string; folder?: string; count?: number };
          const service = await this.getService(args.accountId);
          const messages = await service.listEmails(args.folder, args.count);
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
          };
          const service = await this.getService(args.accountId);
          const messages = await service.searchEmails({
            from: args.from,
            subject: args.subject,
            since: args.since,
            before: args.before,
            keywords: args.keywords
          }, args.folder, args.count);
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

        if (request.params.name === 'send_email') {
          const args = request.params.arguments as { accountId: string; to: string; subject: string; body: string; isHtml?: boolean; cc?: string; bcc?: string };
          const service = await this.getService(args.accountId);
          await service.sendEmail(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc);
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
          const args = request.params.arguments as { accountId: string; to: string; subject: string; body: string; isHtml?: boolean; cc?: string; bcc?: string };
          const service = await this.getService(args.accountId);
          await service.createDraft(args.to, args.subject, args.body, args.isHtml, args.cc, args.bcc);
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

        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mail MCP server running on stdio');
  }
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'read-only': { type: 'boolean', default: false },
  },
  strict: false,
});

const server = new MailMCPServer((values['read-only'] as boolean | undefined) ?? false);
server.run().catch(console.error);
