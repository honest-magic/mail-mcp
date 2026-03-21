# Technology Stack

**Project:** Mail MCP
**Researched:** 2024-05-22

## Recommended Stack

### Node.js (IMAP & SMTP)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `imapflow` | `^1.0.158` | IMAP Client | Modern, native async/await, handles connection locking, built-in IDLE, and Gmail threading. |
| `nodemailer` | `^6.9.13` | SMTP Client | The gold standard for Node.js; zero dependencies, supports multiple transports, extremely stable. |
| `mailparser` | `^3.7.1` | MIME Parsing | Best-in-class MIME parser to handle attachments and body extraction for Node.js. |

### Go (IMAP & SMTP)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `go-imap/v2` | `v2.0.0-beta.x` | IMAP Client | Implements IMAP4rev2 (RFC 9051), better concurrency than v1, native SORT/THREAD support. |
| `go-mail` | `v0.4.4` | SMTP Client | Actively maintained successor to `gomail`, modern API, robust attachment and SSL/TLS handling. |
| `go-message` | `v2.17.1` | MIME Parsing | Standard library for parsing MIME messages in the Go ecosystem (from emersion). |

## Comparison

| Feature | Node.js (ImapFlow + Nodemailer) | Go (go-imap v2 + go-mail) |
|---------|---------------------------------|---------------------------|
| **IDLE support** | Built-in (automatic detection) | Built-in in v2 (native protocol) |
| **Attachments** | High (via `mailparser` integration) | High (via `go-message` integration) |
| **Threading** | High (supports Gmail X-GM-THRID and RFC 5256) | High (RFC 5256 and RFC 9051 native) |
| **Maintenance** | **Very High** (Maintained by Nodemailer team) | **High** (Actively developed beta/v2) |
| **Integration** | Native Async/Await | Native Goroutines & Channels |
| **Security** | TLS 1.2/1.3, STARTTLS support | TLS 1.2/1.3, STARTTLS support |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Node IMAP | `imapflow` | `node-imap` | `node-imap` is legacy, callback-heavy, and unmaintained. |
| Node IMAP | `imapflow` | `imap-simple` | Only a wrapper around the legacy `node-imap`; inherits its bugs. |
| Go SMTP | `go-mail` | `gomail.v2` | Effectively unmaintained; lacks modern Go features like contexts. |
| Go SMTP | `go-mail` | `net/smtp` | Too low-level; requires manual MIME construction for HTML/attachments. |

## Installation

### Node.js
```bash
# Install core mail libraries
npm install imapflow nodemailer mailparser
```

### Go
```bash
# Add dependencies to go.mod
go get github.com/emersion/go-imap/v2
go get github.com/wneessen/go-mail
go get github.com/emersion/go-message
```

## Sources
- [ImapFlow Documentation](https://imapflow.com/) (HIGH confidence)
- [Nodemailer Official Site](https://nodemailer.com/) (HIGH confidence)
- [go-imap v2 Repository](https://github.com/emersion/go-imap) (MEDIUM confidence - Beta)
- [wneessen/go-mail Documentation](https://github.com/wneessen/go-mail) (HIGH confidence)
