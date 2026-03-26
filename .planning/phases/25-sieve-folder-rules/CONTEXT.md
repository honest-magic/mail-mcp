# Phase 25: SIEVE Folder Rules — Context

## What We're Building

Four MCP tools that let AI agents manage server-side email filters via the ManageSieve protocol (RFC 5804):

- `list_filters` — list all SIEVE scripts on the server
- `get_filter` — retrieve a single script's content
- `set_filter` — create or replace a named SIEVE script
- `delete_filter` — delete a named SIEVE script

A `SieveClient` class handles the raw TCP/TLS ManageSieve connection. No npm library required — the ManageSieve protocol is a simple line-based text protocol over port 4190.

## Design Constraints

- ManageSieve runs on a separate port (default 4190), not IMAP port
- Config: add optional `manageSievePort` to account schema (default 4190)
- Connection is separate from the IMAP connection — no shared state
- Many providers (Gmail, Outlook) do NOT support ManageSieve; must fail gracefully
- SIEVE script content is AI-authored — we just transport it to the server
- Auth mirrors IMAP: password (PLAIN SASL) or OAuth2 (OAUTHBEARER)
- TLS: use `tls.connect()` with `rejectUnauthorized: false` for self-signed certs common on self-hosted servers

## ManageSieve Protocol Summary (RFC 5804)

```
Client connects → Server sends capability greeting (SASL AUTHENTICATE, etc.)
Client: AUTHENTICATE "PLAIN" <base64-encoded credentials>
Server: OK
Client: LISTSCRIPTS
Server: <script names, active marker>
        OK
Client: PUTSCRIPT "scriptname" {length+}
        <script content>
Server: OK
Client: GETSCRIPT "scriptname"
Server: {length}
        <script content>
        OK
Client: DELETESCRIPT "scriptname"
Server: OK
Client: SETACTIVE "scriptname"  (to make a script active)
Server: OK
Client: LOGOUT
Server: OK BYE
```

Key format notes:
- Strings: `"literal"` for short names, `{N+}\r\n<N bytes>` for multi-line content
- Server responses: `OK`, `NO`, `BYE` on their own line or with quoted message
- SASL PLAIN: `\0username\0password` → base64

## File Structure

```
src/protocol/sieve.ts        — SieveClient class (ManageSieve over TLS)
src/protocol/sieve.test.ts   — unit tests (mock TCP socket)
src/index.ts                 — 4 new tool definitions + dispatch handlers
src/config.ts                — add manageSievePort optional field
```

## Error Handling

- Connection refused / timeout → "ManageSieve not supported by this server. SIEVE filters require ManageSieve (RFC 5804) support, which is typically available on self-hosted servers but not on Gmail or Outlook."
- Authentication failure → clear message with NO response
- Script not found → NO response from GETSCRIPT/DELETESCRIPT — surface as error
- All errors surface via the existing `isError: true` pattern in index.ts

## Tool Annotations

- `list_filters`: `readOnlyHint: true`
- `get_filter`: `readOnlyHint: true`
- `set_filter`: `readOnlyHint: false, destructiveHint: true` (overwrites existing scripts)
- `delete_filter`: `readOnlyHint: false, destructiveHint: true`

## Account Config Change

```json
{
  "id": "work",
  "host": "imap.example.com",
  "port": 993,
  "manageSievePort": 4190,
  ...
}
```

`manageSievePort` defaults to `4190` in SieveClient if not specified.
