import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./config.js', () => ({
  getAccounts: vi.fn().mockReturnValue([]),
}));

vi.mock('./services/mail.js', () => ({
  MailService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listEmails: vi.fn().mockResolvedValue([]),
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
