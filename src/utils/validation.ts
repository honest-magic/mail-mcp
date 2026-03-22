import { ValidationError } from '../errors.js';

// ReDoS-safe email regex — no nested quantifiers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches angle-bracket format: "Name <user@example.com>"
const ANGLE_BRACKET_RE = /<([^>]+)>/;

/**
 * Validates one or more email address fields (to, cc, bcc).
 * Each field may contain multiple comma-separated addresses or be undefined.
 * Throws ValidationError listing all invalid addresses if any are found.
 */
export function validateEmailAddresses(...addrFields: Array<string | undefined>): void {
  const invalid: string[] = [];

  for (const field of addrFields) {
    if (field === undefined || field === '') continue;

    const entries = field.split(',').map((e) => e.trim());

    for (const entry of entries) {
      if (entry === '') continue;

      // Extract address from angle-bracket format or use raw entry
      const angleMatch = ANGLE_BRACKET_RE.exec(entry);
      const address = angleMatch ? angleMatch[1].trim() : entry;

      if (!EMAIL_RE.test(address)) {
        invalid.push(entry);
      }
    }
  }

  if (invalid.length > 0) {
    throw new ValidationError('Invalid email address(es): ' + invalid.join(', '));
  }
}
