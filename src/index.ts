#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAccounts } from './config.js';

class MailMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mail-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_accounts',
          description: 'List configured mail accounts',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
      throw new Error('Tool not found');
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mail MCP server running on stdio');
  }
}

const server = new MailMCPServer();
server.run().catch(console.error);
