# Feature Landscape: Mail MCP Server

**Domain:** Email Automation & AI Context
**Researched:** 2025-05-15
**Overall Confidence:** HIGH

## Table Stakes

Features users expect in any mail integration. Missing these makes the server feel incomplete or unusable for basic tasks.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Search & List** | Finding relevant emails is the primary starting point for any AI task. | Medium | Needs support for advanced queries (from, to, date, keyword). |
| **Read Email** | AI needs the full body content to reason, summarize, or extract data. | Low | Must handle both plaintext and HTML sanitized for LLMs. |
| **Send/Reply** | Taking action on behalf of the user is the core value proposition. | Medium | Requires proper header management (In-Reply-To, References) for threads. |
| **Draft Management**| Safety first: AI should often create a draft for user review rather than sending. | Low | Essential for "Human-in-the-Loop" workflows. |
| **Attachment Metadata**| AI needs to know if files are present to suggest downloading or reading them. | Low | Just metadata (name, size, type) initially. |

## Differentiators

Features that set this MCP server apart and enable advanced agentic workflows.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Thread Awareness** | Allows AI to see the full context of a conversation, not just the last message. | High | Fetching and grouping messages by `threadId`. |
| **Bulk Actions** | Enables "triage" workflows (e.g., "Archive all newsletters from last week"). | Medium | Requires batch API support to avoid rate limits. |
| **Contact Lookup** | Enriches email data with contact names and history for better personalization. | Medium | May require secondary API access (e.g., Google Contacts). |
| **Attachment Retrieval**| Allows AI to "read" the contents of PDFs or Docs attached to emails. | High | Requires local storage or temporary URL management. |
| **Folder/Label Mgmt** | Enables automated organization and classification of the inbox. | Medium | Crucial for "Inbox Zero" automation agents. |

## Anti-Features

Features to explicitly NOT build or handle with extreme caution.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Raw HTML Rendering**| LLMs struggle with raw HTML noise and it wastes tokens. | Sanitize HTML to Markdown or clean text before sending to LLM. |
| **Auto-Send (Default)**| High risk of hallucinations, wrong recipients, or bad tone. | Default to `create_draft` or require explicit user confirmation. |
| **Password Storage** | Security risk. | Use OAuth2 or provider-specific App Passwords via environment variables. |

## Feature Dependencies

```
Search/List → Read Email (Can't read what you can't find)
Read Email → Reply/Send (Can't reply without context)
Attachment Metadata → Download Attachment (Can't download what you don't know exists)
Thread Awareness → Summarization (Requires full history for accurate summary)
```

## MVP Recommendation

### 10-15 Specific Tools & Resources

| Tool Name | Purpose | Inputs |
|-----------|---------|--------|
| `list_messages` | List recent emails with snippets. | `maxResults`, `labelIds` |
| `get_message` | Get full content of a message. | `messageId`, `format` (text/markdown) |
| `search_messages` | Find emails matching a query. | `query` (e.g., "from:boss after:2024/01/01") |
| `send_message` | Send a new email. | `to`, `subject`, `body`, `cc`, `bcc` |
| `reply_to_message`| Reply to an existing thread. | `messageId`, `body` |
| `create_draft` | Save a draft for review. | `to`, `subject`, `body`, `threadId` |
| `archive_message` | Move message out of inbox. | `messageId` |
| `trash_message` | Move message to trash/bin. | `messageId` |
| `modify_labels` | Add or remove labels (tags). | `messageId`, `addLabelIds`, `removeLabelIds` |
| `get_thread` | Get all messages in a thread. | `threadId` |
| `list_labels` | List available folders/labels. | None |
| `download_attachment`| Get attachment content. | `messageId`, `attachmentId` |
| `batch_modify` | Apply changes to many emails. | `ids[]`, `addLabelIds`, `removeLabelIds` |
| `search_contacts` | Find contact details. | `query` (name or email) |

### Resource Types

- **Message:** Standardized object containing `id`, `threadId`, `subject`, `from`, `to`, `body`, `date`, and `labels`.
- **Thread:** A collection of `Messages` grouped by conversation.
- **Attachment:** Metadata including `filename`, `mimeType`, and `size`.
- **Label/Folder:** Organizational unit with `id` and `name`.

## Workflow Examples

### 1. Automated Triage Agent
**User:** "Clean up my inbox from all the 'Sales' emails I got today."
**AI Action:**
1. Calls `search_messages(query="category:promotions after:today")`.
2. For each relevant message, calls `get_message` to verify content.
3. Calls `batch_modify(ids=[...], addLabelIds=['TRASH'])` or `archive_message`.

### 2. Meeting Prep Agent
**User:** "Give me a summary of my last discussion with Jane about the 'Solaris' project."
**AI Action:**
1. Calls `search_messages(query="from:Jane Solaris")`.
2. Identifies the relevant `threadId`.
3. Calls `get_thread(threadId=...)`.
4. Summarizes the conversation and extracts action items.

### 3. Smart Follow-up Agent
**User:** "Draft a follow-up to everyone who hasn't replied to my 'Partnership' email from Monday."
**AI Action:**
1. Calls `search_messages(query="subject:Partnership after:2025/05/12")`.
2. For each message, calls `get_thread` to check if there is a newer reply.
3. If no reply, calls `create_draft` with a personalized follow-up message.

## Best Practices for AI Interaction

1. **Human-in-the-Loop:** Always recommend creating a draft for high-stakes emails. The UI should display: "I've created a draft in your Gmail for you to review."
2. **Token Efficiency:** Truncate long email bodies or remove signature blocks/disclaimers before passing to the LLM.
3. **Safety Gates:** Implement a `dry_run` parameter for destructive actions like `trash_message` or `batch_modify`.
4. **Transparency:** The agent should explain *why* it is selecting certain emails (e.g., "Found 3 emails from Jane mentioning 'Solaris'").
5. **Reversibility:** Provide an easy way to undo bulk actions (e.g., by logging IDs of modified messages).

## Sources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Microsoft Graph Mail API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [MCP Specification](https://modelcontextprotocol.io)
- [Industry Research on AI UX Design Patterns (2025)](https://uxdesign.cc)
