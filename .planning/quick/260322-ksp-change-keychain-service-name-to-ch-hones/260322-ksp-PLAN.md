---
phase: quick
plan: 260322-ksp
type: execute
wave: 1
depends_on: []
files_modified:
  - src/config.ts
  - README.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Keychain entries are written under service name ch.honest-magic.config.mail-server"
    - "README credential example uses the new service name"
  artifacts:
    - path: src/config.ts
      provides: "Default serviceName constant"
      contains: "ch.honest-magic.config.mail-server"
    - path: README.md
      provides: "security add-generic-password example"
      contains: "ch.honest-magic.config.mail-server"
  key_links:
    - from: src/config.ts
      to: src/security/keychain.ts
      via: "config.serviceName passed to cross-keychain setPassword/getPassword/deletePassword"
      pattern: "default\\('ch\\.honest-magic\\.config\\.mail-server'\\)"
---

<objective>
Rename the macOS Keychain service identifier from `com.mcp.mail-server` to
`ch.honest-magic.config.mail-server` so the service name aligns with the
package's reverse-domain convention, then rebuild so dist reflects the change.

Purpose: Consistency between the published npm package name (@honest-magic/*)
and the Keychain service name visible in Keychain Access.app.
Output: Updated src/config.ts, updated README.md, fresh dist build.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/config.ts
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update default service name in config and README</name>
  <files>src/config.ts, README.md</files>
  <action>
In src/config.ts line 8, change the Zod default from 'com.mcp.mail-server' to
'ch.honest-magic.config.mail-server':

  serviceName: z.string().default('ch.honest-magic.config.mail-server'),

In README.md, the `security add-generic-password` example on line 66 uses
`-s com.mcp.mail-server`. Change it to `-s ch.honest-magic.config.mail-server`.

Also update the prose on line 88 ("stored in Keychain under the same service
name") — it references the service name implicitly and needs no change, but
verify the surrounding text still reads correctly after the edit.

Do NOT change anything in src/security/keychain.ts — it reads the value from
config.serviceName at runtime; no hardcoded string lives there.
  </action>
  <verify>
    <automated>grep -n "ch.honest-magic.config.mail-server" /Users/mis/dev/mail_mcp/src/config.ts /Users/mis/dev/mail_mcp/README.md</automated>
  </verify>
  <done>Both files contain exactly one occurrence of ch.honest-magic.config.mail-server; old string com.mcp.mail-server is absent from both files.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild dist</name>
  <files>dist/</files>
  <action>
Run the TypeScript compiler to regenerate dist so the published artefact
reflects the new default:

  npm run build

Confirm the compiled output contains the new string.
  </action>
  <verify>
    <automated>grep -r "ch.honest-magic.config.mail-server" /Users/mis/dev/mail_mcp/dist/ | head -5</automated>
  </verify>
  <done>npm run build exits 0 and dist/ contains the new service name string.</done>
</task>

</tasks>

<verification>
After both tasks:
- grep confirms no remaining occurrences of com.mcp.mail-server in src/config.ts, README.md, or dist/
- npm run build exits 0
</verification>

<success_criteria>
- src/config.ts default is ch.honest-magic.config.mail-server
- README.md security add-generic-password example uses ch.honest-magic.config.mail-server
- dist/ rebuilt with new value
- No other files changed
</success_criteria>

<output>
After completion, create `.planning/quick/260322-ksp-change-keychain-service-name-to-ch-hones/260322-ksp-SUMMARY.md`
</output>
