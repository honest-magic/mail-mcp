import { describe, it, expect } from 'vitest';
import { ValidationError } from '../errors.js';
import { validateEmailAddresses } from './validation.js';

describe('validateEmailAddresses', () => {
  it('throws ValidationError for a syntactically invalid address', () => {
    expect(() => validateEmailAddresses('notanemail')).toThrowError(ValidationError);
  });

  it('thrown message contains the invalid address', () => {
    expect(() => validateEmailAddresses('notanemail')).toThrowError(/notanemail/);
  });

  it('does not throw for a plain valid address', () => {
    expect(() => validateEmailAddresses('user@example.com')).not.toThrow();
  });

  it('does not throw for angle-bracket format', () => {
    expect(() => validateEmailAddresses('Name <user@example.com>')).not.toThrow();
  });

  it('throws ValidationError listing invalid entry in comma-separated list', () => {
    let thrown: unknown;
    try {
      validateEmailAddresses('a@b.com, notvalid, c@d.com');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).message).toMatch(/notvalid/);
  });

  it('does not throw when argument is undefined (optional field)', () => {
    expect(() => validateEmailAddresses(undefined)).not.toThrow();
  });

  it('does not throw for mixed present/absent fields', () => {
    expect(() => validateEmailAddresses('a@b.com', undefined, 'c@d.com')).not.toThrow();
  });

  it('throws ValidationError for address with whitespace in local part', () => {
    expect(() => validateEmailAddresses('user @example.com')).toThrowError(ValidationError);
  });

  it('does not throw for empty string (no addresses)', () => {
    expect(() => validateEmailAddresses('')).not.toThrow();
  });

  it('error message starts with "Invalid email address(es):"', () => {
    expect(() => validateEmailAddresses('bad')).toThrowError(/Invalid email address\(es\):/);
  });
});
