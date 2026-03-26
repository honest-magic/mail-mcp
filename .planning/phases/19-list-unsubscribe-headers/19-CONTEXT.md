# Phase 19: List-Unsubscribe Headers - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning (auto mode)

<domain>
## Phase Boundary

Extract RFC 2369 List-Unsubscribe headers from emails and surface them as structured data in read_email output. Enables AI agents to automate mailing list unsubscription.

</domain>

<decisions>
## Implementation Decisions

### Where to surface unsubscribe data
- **D-01:** Add List-Unsubscribe info to the `readEmail()` output string, in the header section (after Message-ID, before body)
- **D-02:** Parse both `List-Unsubscribe` (mailto: and https: URLs) and `List-Unsubscribe-Post` (one-click unsubscribe) headers
- **D-03:** Format as `**Unsubscribe:** <url>` for https links and `**Unsubscribe (mailto):** <email>` for mailto links

### Parsing approach
- **D-04:** Use `parsed.headers.get('list-unsubscribe')` from the ParsedMail object — already available in `readEmail()`
- **D-05:** Parse the header value which is typically `<mailto:unsub@list.com>, <https://list.com/unsub>` — extract both URL types
- **D-06:** If `List-Unsubscribe-Post: List-Unsubscribe=One-Click` is present, note one-click capability

### Claude's Discretion
- Exact regex/parsing for the angle-bracket-delimited header format
- Whether to add a helper function or parse inline
- Test approach

</decisions>

<canonical_refs>
## Canonical References

- `src/services/mail.ts` line 133 — `readEmail()` where header output is built
- `src/services/mail.ts` line 177 — existing pattern for reading headers from ParsedMail (`parsed.headers.get()`)

</canonical_refs>

<code_context>
## Existing Code Insights

- `readEmail()` already builds a header block with From/To/Cc/Subject/Date/Thread-ID/Message-ID
- `parsed.headers` is a Map — `parsed.headers.get('list-unsubscribe')` returns the raw header value
- The header value format is: `<mailto:unsub@example.com>, <https://example.com/unsub?token=xyz>`
- No functional changes to the IMAP fetch path — just extract more headers from the already-parsed email

</code_context>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 19-list-unsubscribe-headers*
*Context gathered: 2026-03-24 (auto mode)*
