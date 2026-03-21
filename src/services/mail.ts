import { ImapClient, MessageMetadata } from '../protocol/imap.js';
import { SmtpClient } from '../protocol/smtp.js';
import { htmlToMarkdown } from '../utils/markdown.js';
import { EmailAccount } from '../types/index.js';

export class MailService {
  private imapClient: ImapClient;
  private smtpClient: SmtpClient;
  private account: EmailAccount;

  constructor(account: EmailAccount) {
    this.account = account;
    this.imapClient = new ImapClient(account);
    this.smtpClient = new SmtpClient(account);
  }

  async connect() {
    await this.imapClient.connect();
    await this.smtpClient.connect();
  }

  async disconnect() {
    await this.imapClient.disconnect();
    // nodemailer transporter doesn't strictly need closing, but good practice if pooling
  }

  async listEmails(folder: string = 'INBOX', count: number = 10): Promise<MessageMetadata[]> {
    return this.imapClient.listMessages(folder, count);
  }

  async searchEmails(query: { from?: string, subject?: string, since?: string, before?: string, keywords?: string }, folder: string = 'INBOX', count: number = 10): Promise<MessageMetadata[]> {
    const criteria: any = {};
    if (query.from) criteria.from = query.from;
    if (query.subject) criteria.subject = query.subject;
    if (query.since) criteria.since = query.since;
    if (query.before) criteria.before = query.before;
    if (query.keywords) criteria.body = query.keywords;

    return this.imapClient.searchMessages(criteria, folder, count);
  }

  async sendEmail(to: string, subject: string, body: string, isHtml: boolean = false, cc?: string, bcc?: string): Promise<any> {
    const info = await this.smtpClient.send(to, subject, body, isHtml, cc, bcc);
    // Append to Sent folder
    const rawMessage = info.message.toString();
    try {
      await this.imapClient.appendMessage('Sent', rawMessage, ['\\Seen']);
    } catch (e) {
      console.error('Failed to append to Sent folder, might be named differently:', e);
    }
    return info;
  }

  async createDraft(to: string, subject: string, body: string, isHtml: boolean = false, cc?: string, bcc?: string): Promise<void> {
    const headers = [
      `From: ${this.account.user}`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ].join('\r\n');

    await this.imapClient.appendMessage('Drafts', headers, ['\\Draft']);
  }

  async readEmail(uid: string, folder: string = 'INBOX'): Promise<string> {
    const parsed = await this.imapClient.fetchMessageBody(uid, folder);
    
    let content = '';

    if (parsed.html) {
      let html = parsed.html;
      // Convert inline images to base64 if needed
      if (parsed.attachments) {
        for (const att of parsed.attachments) {
          if (att.contentId && att.content && att.contentType.startsWith('image/')) {
            const base64 = att.content.toString('base64');
            const dataUri = `data:${att.contentType};base64,${base64}`;
            const cidRegex = new RegExp(`cid:${att.contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            html = html.replace(cidRegex, dataUri);
          }
        }
      }
      content = htmlToMarkdown(html);
    } else if (parsed.textAsHtml) {
      content = htmlToMarkdown(parsed.textAsHtml);
    } else if (parsed.text) {
      content = parsed.text;
    }

    let attachmentInfo = '';
    if (parsed.attachments && parsed.attachments.length > 0) {
      attachmentInfo = '\n\n**Attachments:**\n';
      parsed.attachments.forEach(att => {
        attachmentInfo += `- ${att.filename || 'Unnamed'} (${att.contentType}, ${Math.round(att.size / 1024)} KB)\n`;
      });
    }

    let header = `**From:** ${parsed.from?.text || 'Unknown'}\n`;
    const toText = Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : parsed.to?.text;
    header += `**To:** ${toText || 'Unknown'}\n`;
    if (parsed.cc) {
      const ccText = Array.isArray(parsed.cc) ? parsed.cc.map(t => t.text).join(', ') : parsed.cc.text;
      header += `**Cc:** ${ccText}\n`;
    }
    header += `**Subject:** ${parsed.subject || 'No Subject'}\n`;
    header += `**Date:** ${parsed.date?.toISOString() || 'Unknown'}\n`;
    
    // Check for thread ID in headers
    const threadId = parsed.headers.get('x-gm-thrid');
    if (threadId) {
      header += `**Thread ID:** ${threadId}\n`;
    }
    
    header += `\n---\n\n`;

    return header + content + attachmentInfo;
  }

  async getThread(threadId: string, folder: string = 'INBOX'): Promise<MessageMetadata[]> {
    return this.imapClient.fetchThreadMessages(threadId, folder);
  }

  async downloadAttachment(uid: string, filename: string, folder: string = 'INBOX'): Promise<{ content: Buffer, contentType: string }> {
    const parsed = await this.imapClient.fetchMessageBody(uid, folder);
    if (!parsed.attachments || parsed.attachments.length === 0) {
      throw new Error('No attachments found in this email');
    }
    const attachment = parsed.attachments.find(a => a.filename === filename);
    if (!attachment) {
      throw new Error(`Attachment "${filename}" not found`);
    }
    return {
      content: attachment.content,
      contentType: attachment.contentType
    };
  }

  async extractAttachmentText(uid: string, filename: string, folder: string = 'INBOX'): Promise<string> {
    const { content, contentType } = await this.downloadAttachment(uid, filename, folder);
    if (contentType === 'application/pdf') {
      const pdf = await import('pdf-parse');
      // Some modules have a .default property when imported via dynamic import in ESM
      const pdfParser = (pdf as any).default || pdf;
      const data = await pdfParser(content);
      return data.text;
    } else if (contentType.startsWith('text/')) {
      return content.toString('utf-8');
    } else {
      throw new Error(`Extraction not supported for content type: ${contentType}`);
    }
  }

  async listFolders(): Promise<string[]> {
    return this.imapClient.listFolders();
  }

  async moveMessage(uid: string, sourceFolder: string, targetFolder: string): Promise<void> {
    return this.imapClient.moveMessage(uid, sourceFolder, targetFolder);
  }

  async modifyLabels(uid: string, folder: string, addLabels: string[], removeLabels: string[]): Promise<void> {
    return this.imapClient.modifyLabels(uid, folder, addLabels, removeLabels);
  }

  async batchOperations(
    uids: string[],
    folder: string,
    operation:
      | { type: 'move'; targetFolder: string }
      | { type: 'delete' }
      | { type: 'label'; addLabels?: string[]; removeLabels?: string[] }
  ): Promise<{ processed: number }> {
    if (uids.length === 0) {
      throw new Error('No UIDs provided for batch operation');
    }
    if (uids.length > 100) {
      throw new Error('Batch operations are limited to 100 emails at once');
    }

    if (operation.type === 'move') {
      await this.imapClient.batchMoveMessages(uids, folder, operation.targetFolder);
    } else if (operation.type === 'delete') {
      await this.imapClient.batchDeleteMessages(uids, folder);
    } else if (operation.type === 'label') {
      await this.imapClient.batchModifyLabels(
        uids,
        folder,
        operation.addLabels || [],
        operation.removeLabels || []
      );
    } else {
      throw new Error(`Unknown batch operation type: ${(operation as any).type}`);
    }

    return { processed: uids.length };
  }
}
