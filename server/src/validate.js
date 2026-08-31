const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX = 120;
const EMAIL_MAX = 254;
const SUBJECT_MAX = 150;
const MESSAGE_MAX = 5000;
const MESSAGE_MIN = 10;
const PLAN_MAX = 60;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

/**
 * Validate and normalize a contact-form payload.
 * The `website` field is a honeypot: real users never see it, spam bots fill it.
 *
 * @returns {{ errors: Record<string,string>, value: { name, email, subject, message, plan, honeypot } }}
 */
export function validateContact(body = {}) {
  const trimStr = (v, max) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';

  const errors = {};
  const value = {
    name: trimStr(body.name, NAME_MAX),
    email: typeof body.email === 'string' ? body.email.trim().slice(0, EMAIL_MAX) : '',
    subject: trimStr(body.subject, SUBJECT_MAX),
    message: trimStr(body.message, MESSAGE_MAX),
    plan: trimStr(body.plan, PLAN_MAX),
    honeypot: typeof body.website === 'string' ? body.website.trim() : '',
  };

  if (!value.name) {
    errors.name = 'Please enter your name.';
  }
  if (!value.email) {
    errors.email = 'Please enter your e-mail address.';
  } else if (!EMAIL_RE.test(value.email)) {
    errors.email = 'Enter a valid e-mail address.';
  }
  if (value.subject && value.subject.length > SUBJECT_MAX) {
    errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
  }
  if (!value.message) {
    errors.message = 'Please enter a message.';
  } else if (value.message.length < MESSAGE_MIN) {
    errors.message = `Your message should be at least ${MESSAGE_MIN} characters long.`;
  }

  return { errors, value };
}

/** Validate and normalize a signup payload. */
export function validateSignup(body = {}) {
  const trimStr = (v, max) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';

  const errors = {};
  const value = {
    name: trimStr(body.name, NAME_MAX),
    email: typeof body.email === 'string' ? body.email.trim().slice(0, EMAIL_MAX) : '',
    password: typeof body.password === 'string' ? body.password : '',
  };

  if (!value.name) errors.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    errors.email = 'Enter a valid e-mail address.';
  }
  if (value.password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters long.`;
  } else if (value.password.length > PASSWORD_MAX) {
    errors.password = `Password must be ${PASSWORD_MAX} characters or fewer.`;
  }

  return { errors, value };
}

/** Validate and normalize a login payload. */
export function validateLogin(body = {}) {
  const errors = {};
  const value = {
    email: typeof body.email === 'string' ? body.email.trim().slice(0, EMAIL_MAX) : '',
    password: typeof body.password === 'string' ? body.password : '',
  };

  if (!value.email) errors.email = 'Please enter your e-mail address.';
  if (!value.password) errors.password = 'Please enter your password.';

  return { errors, value };
}