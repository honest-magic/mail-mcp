import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./config.js', () => ({
  getAccounts: vi.fn().mockReturnValue([]),
}));

const mockSearchEmails = vi.fn().mockResolvedValue([
  { id: '42', uid: 42, subject: 'Found Email', from: 'sender@example.com' }
]);
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockListFolders = vi.fn().mockResolvedValue(['INBOX', 'Sent', 'Drafts', 'Trash']);
const mockMoveMessage = vi.fn().mockResolvedValue(undefined);
const mockModifyLabels = vi.fn().mockResolvedValue(undefined);

vi.mock('./services/mail.js', () => ({
  MailService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listEmails: vi.fn().mockResolvedValue([]),
    searchEmails: mockSearchEmails,
    sendEmail: mockSendEmail,
    listFolders: mockListFolders,
    moveMessage: mockMoveMessage,
    modifyLabels: mockModifyLabels,
  })),
}));

import { MailMCPServer } from './index.js';

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
