# Roadmap: Mail MCP Server

## Phases

- [x] **Phase 1: Secure Connectivity & Basic Messaging** - Establish secure IMAP/SMTP connections and enable basic read/send capabilities.
- [x] **Phase 2: Discovery & Organization** - Implement advanced search, folder management, and mailbox organization.
- [x] **Phase 3: Context & Resources** - Add thread reconstruction and attachment handling for deeper reasoning.
- [x] **Phase 4: Efficiency & Scale** - Optimize with batch operations and performance improvements.
- [x] **Phase 5: Read-Only Enforcement** - Add `--read-only` startup flag, write-tool guard, tool filtering, and MCP annotations. (completed 2026-03-21)
- [x] **Phase 6: Mode Discoverability & Connection Hygiene** - Expose mode to MCP clients at handshake and skip unnecessary SMTP authentication. (completed 2026-03-22)
- [x] **Phase 7: npm Package Setup** - Configure package.json for public npm distribution and verify the build produces a self-contained publishable artifact. (completed 2026-03-22)
- [x] **Phase 8: GitHub Repository** - Create the public repo under `honest-magic`, write a consumer-facing README, and push all existing commits. (completed 2026-03-22)
- [x] **Phase 9: GitHub Actions** - Add CI workflow (type-check + test) and tag-based publish workflow with a mandatory CI gate. (completed 2026-03-22)

## Phase Details

### Phase 1: Secure Connectivity & Basic Messaging
**Goal**: Securely connect to mail servers and perform basic read/write operations.
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, IMAP-01, IMAP-02, SMTP-01, SMTP-03, SMTP-04
**Success Criteria** (what must be TRUE):
1. User can securely store and retrieve credentials using macOS Keychain.
2. User can connect to IMAP/SMTP servers using TLS/SSL or OAuth2.
3. User can list recent messages and read their content sanitized as Markdown.
4. User can send a new email and verify it appears in the "Sent" folder via IMAP APPEND.
5. User can create a draft in the "Drafts" folder for human-in-the-loop safety.
**Plans**: 4
- [x] 01-01-PLAN.md — Setup project structure and basic keychain security.
- [x] 01-02-PLAN.md — Implement IMAP connection and basic reading.
- [x] 01-03-PLAN.md — Implement SMTP sending and sync to Sent folder.
- [x] 01-04-PLAN.md — Implement OAuth2 support.

### Phase 2: Discovery & Organization
**Goal**: Find specific information and manage mailbox structure.
**Depends on**: Phase 1
**Requirements**: IMAP-03, IMAP-04, SMTP-02, ORG-01, ORG-02
**Success Criteria** (what must be TRUE):
1. User can search for emails using advanced criteria (sender, subject, date range).
2. User can list all available folders/labels and move messages between them.
3. User can add or remove labels/tags on messages (supporting provider-specific extensions).
4. User can send emails with CC and BCC recipients.
**Plans**: 2
- [x] 02-01-PLAN.md — Advanced Search & SMTP CC/BCC.
- [x] 02-02-PLAN.md — Folders & Label Management.

### Phase 3: Context & Resources
**Goal**: Reason over full conversations and supplementary files.
**Depends on**: Phase 1, Phase 2
**Requirements**: THRD-01, THRD-02, THRD-03, RES-01, RES-02, RES-03
**Success Criteria** (what must be TRUE):
1. User can fetch a complete thread of messages grouped by thread ID.
2. User can view a token-efficient, summarization-friendly representation of a conversation.
3. User can list attachment metadata and download content via MCP Resource URIs.
4. User can see extracted text from PDF and common document attachments.
**Plans**: 2
- [x] 03-01-PLAN.md — Thread Reconstruction & Conversations.
- [x] 03-02-PLAN.md — Attachment Resources & Text Extraction.

### Phase 4: Efficiency & Scale
**Goal**: Perform high-volume actions efficiently.
**Depends on**: Phase 2
**Requirements**: ORG-03
**Success Criteria** (what must be TRUE):
1. User can perform batch operations (move, delete, label) on many emails in a single request.
**Plans**: 1
- [x] 04-01-PLAN.md — Implement batch operations (move, delete, label).

### Phase 5: Read-Only Enforcement
**Goal**: Users can start the server in read-only mode where write operations are blocked at both list-time and call-time, and all read operations remain fully functional.
**Depends on**: Phase 4
**Requirements**: ROM-01, ROM-02, ROM-03, ROM-05, ROM-06
**Success Criteria** (what must be TRUE):
1. User can start the server with `--read-only` and no write-capable tools appear in the MCP tool list.
2. Any attempt to call a write tool in read-only mode returns a descriptive error naming the blocked tool and the active mode.
3. All read and search tools (`list_emails`, `read_email`, `search_emails`, `list_folders`, `get_thread`, `list_attachments`, `get_attachment`) function normally with no change in behavior.
4. Every tool definition in the server declares `readOnlyHint` and `destructiveHint` annotations visible to MCP clients.
**Plans**: 1
- [x] 05-01-PLAN.md — Implement WRITE_TOOLS, readOnly flag, call/list guards, and tool annotations.

### Phase 6: Mode Discoverability & Connection Hygiene
**Goal**: MCP clients receive the server's active mode automatically at handshake, and no unnecessary SMTP authentication occurs when the server is read-only.
**Depends on**: Phase 5
**Requirements**: ROM-04, ROM-07
**Success Criteria** (what must be TRUE):
1. An MCP client that connects to the server in read-only mode receives the mode in the `instructions` field of `InitializeResult` without making any tool call.
2. When the server starts with `--read-only`, no SMTP connection or authentication attempt is made.
**Plans**: 1
- [x] 06-01-PLAN.md — Add instructions field to Server constructor and skip SMTP connect in read-only mode.

### Phase 7: npm Package Setup
**Goal**: `package.json` is fully configured for public npm distribution and `npm run build` produces a self-contained, executable artifact that consumers can run via `npx` or global install.
**Depends on**: Phase 6
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
1. Running `npm pack --dry-run` shows only `dist/`, `README.md`, and `LICENSE` in the tarball.
2. Running `npx .` (or pointing npx at the local package) starts the MCP server without error.
3. `package.json` declares `name: "@honest-magic/mail-mcp"`, `version: "1.0.0"`, `publishConfig: { access: "public" }`, and `bin: { "mail-mcp": "dist/index.js" }`.
4. `npm run build` succeeds and `dist/index.js` has a `#!/usr/bin/env node` shebang so it is directly executable.
**Plans**: 1
- [x] 07-01-PLAN.md — Update package.json for npm distribution and create LICENSE file.

### Phase 8: GitHub Repository
**Goal**: The project exists as a public GitHub repository under `honest-magic` with all commit history and a README that lets any consumer install and configure the server in under five minutes.
**Depends on**: Phase 7
**Requirements**: GH-01, GH-02
**Success Criteria** (what must be TRUE):
1. `github.com/honest-magic/mail-mcp` is publicly accessible and all existing local commits are present in `main`.
2. The README covers installation (`npx` and global), MCP client configuration (JSON snippet), all available tools, and the `--read-only` flag.
3. A visitor to the repo page can follow the README alone to connect the server to an MCP client without consulting any other document.
**Plans**: 2
- [x] 08-01-PLAN.md — Write consumer-facing README.md
- [x] 08-02-PLAN.md — Create GitHub repo, push commits, set topics and branch protection

### Phase 9: GitHub Actions
**Goal**: Every push to `main` is automatically type-checked and tested, and pushing a `v*` tag publishes a verified build of `@honest-magic/mail-mcp` to npm only after CI passes.
**Depends on**: Phase 8
**Requirements**: GHA-01, GHA-02, GHA-03
**Success Criteria** (what must be TRUE):
1. Pushing a commit to `main` triggers the CI workflow and the Actions tab shows `tsc --noEmit` and `npm test` both completing successfully.
2. Pushing a `v1.0.0` tag triggers the publish workflow, which publishes `@honest-magic/mail-mcp@1.0.0` to the public npm registry.
3. If the CI job fails, the publish job does not run (enforced via `needs: ci` in the publish workflow).
**Plans**: 2
- [x] 09-01-PLAN.md — Create CI workflow (type-check + test on push/PR to main)
- [x] 09-02-PLAN.md — Create publish workflow (v* tag → build → npm publish, needs: ci)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Connectivity & Basic Messaging | 4/4 | Complete | 2026-03-21 |
| 2. Discovery & Organization | 1/2 | In Progress|  |
| 3. Context & Resources | 2/2 | Complete | 2026-03-21 |
| 4. Efficiency & Scale | 1/1 | Complete | 2026-03-21 |
| 5. Read-Only Enforcement | 1/1 | Complete | 2026-03-21 |
| 6. Mode Discoverability & Connection Hygiene | 1/1 | Complete | 2026-03-22 |
| 7. npm Package Setup | 1/1 | Complete   | 2026-03-22 |
| 8. GitHub Repository | 2/2 | Complete   | 2026-03-22 |
| 9. GitHub Actions | 2/2 | Complete   | 2026-03-22 |
