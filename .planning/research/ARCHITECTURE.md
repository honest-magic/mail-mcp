# Architecture Patterns: Email MCP Server

**Domain:** Email (IMAP/SMTP)
**Researched:** 2024-05-20
**Overall Confidence:** HIGH

## Recommended Architecture

The system follows a tiered architecture to separate the Model Context Protocol (MCP) interface from the low-level email protocols and security concerns.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **MCP Layer** | Defines Tools and Resources; handles JSON-RPC communication. | LLM / Host (Claude), Service Layer |
| **Service Layer** | Orchestrates business logic (searching, threading, attachment mapping). | MCP Layer, Protocol Layer, Storage Layer |
| **Protocol Layer** | Low-level IMAP (imapflow) and SMTP (nodemailer) interactions. | Service Layer, External Mail Servers |
| **Security Layer** | Secure credential management via macOS Keychain (cross-keychain). | Service Layer, macOS System |
| **Storage Layer** | Temporary file storage for attachments; header caching. | Service Layer, Local Filesystem |

### Data Flow

1.  **Incoming Request:** Host (Claude) calls a tool (e.g., `search_emails`).
2.  **Logic Execution:** `EmailService` fetches credentials from `Security Layer`, then requests data from `Protocol Layer`.
3.  **Processing:** `EmailService` processes headers for threading and saves attachments to `Storage Layer`.
4.  **Response:** `MCP Layer` returns text previews and `ResourceLinks` for large content or attachments.

## Service Layer Structure

### MCP vs Protocol vs Domain
- **MCP (Interface):** Defines the "surface" (e.g., `tool("send_email", ...)`). It should only handle argument validation (Zod) and formatting the final response.
- **Protocol (Infrastructure):** Technical implementation of IMAP/SMTP. It handles socket connections, TLS, and protocol-specific parsing.
- **Domain (Service):** The "Brain". It decides how to map an IMAP response to a conversation thread, or how to handle a draft vs. a sent email.

## Security Patterns (macOS)

### Credential Storage
Avoid storing passwords in `.env` or plaintext files. Use the **macOS Keychain**.

**Recommendation:** Use `cross-keychain` for a modern, cross-platform (but macOS-first) approach.

```typescript
import { setPassword, getPassword } from "cross-keychain";

const SERVICE_NAME = "com.mcp.email-server";

async function getCredentials(account: string) {
  const password = await getPassword(SERVICE_NAME, account);
  if (!password) throw new Error("Credentials not found in Keychain");
  return password;
}
```

**Implementation Tip:** Use a unique service name to isolate credentials from other Node.js applications.

## Handling of Attachments

LLMs cannot ingest large binary data. Use a **Reference-Based Pattern**.

1.  **Fetch:** When an email is retrieved, the `AttachmentService` extracts attachments.
2.  **Store:** Save attachments to a local temporary directory (`/tmp/mcp-attachments/<id>/`).
3.  **Reference:** Return an MCP Resource URI (e.g., `mcp://attachments/<id>/invoice.pdf`).
4.  **On-Demand Access:** The LLM only "sees" the attachment content if it calls a specific `read_attachment` tool or fetches the resource, at which point the server returns a preview or a Base64 blob (if < 1MB).

## Threading Logic

Threading is critical for LLM context. Use standard email headers:

- **Message-ID:** Unique ID of the message.
- **In-Reply-To:** Message-ID of the parent.
- **References:** List of all Message-IDs in the conversation chain.

### Logic Flow:
```typescript
function getParentId(envelope, headers) {
  // 1. Try In-Reply-To
  if (envelope.inReplyTo) return envelope.inReplyTo;
  // 2. Fallback to last ID in References
  const refs = headers.get('references');
  if (refs && refs.length > 0) return refs[refs.length - 1];
  return null; // Root message
}
```

## Performance Considerations

### 1. Connection Pooling
`imapflow` handles connection pooling and command queuing internally. Reuse a single client instance per account rather than connecting/disconnecting for every tool call.

### 2. IMAP IDLE
Enable IDLE to receive real-time updates. This allows the MCP server to push notifications to the host when new mail arrives without polling.

### 3. Header Caching
Fetching full message bodies is expensive. Cache the `envelope` and `headers` in memory or a local SQLite database to allow fast searching and thread reconstruction without repeated network round-trips.

## Sources
- [MCP Official Documentation](https://modelcontextprotocol.io)
- [imapflow Documentation](https://imapflow.com/)
- [cross-keychain GitHub](https://github.com/magarcia/cross-keychain)
- [Nodemailer Documentation](https://nodemailer.com/)
