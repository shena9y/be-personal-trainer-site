import nodemailer from 'nodemailer';

/**
 * E-mail a newly submitted contact message to the site owner.
 *
 * SMTP is entirely optional: when `config.smtpHost` is empty the function
 * resolves without doing anything, so deployments without mail still work.
 * Failures are logged and swallowed — the message is already persisted in
 * SQLite, so we never want a mail hiccup to break the HTTP response.
 */
export async function sendMessageNotification(message, config) {
  if (!config.smtpHost) return;

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      ...(config.smtpUser
        ? { auth: { user: config.smtpUser, pass: config.smtpPass } }
        : {}),
    });
  } catch (err) {
    console.error('[mailer] transport setup failed:', err.message);
    return;
  }

  const mail = {
    from: config.smtpFrom,
    to: config.notifyTo || config.smtpFrom,
    replyTo: `"${message.name}" <${message.email}>`,
    subject: message.subject
      ? `New site message: ${message.subject}`
      : 'New message from the Be Personal Trainer site',
    text: [
      'New message from the "Be Personal Trainer" contact form:',
      '',
      `From:    ${message.name} <${message.email}>`,
      `Subject: ${message.subject || '(none)'}`,
      message.plan ? `Plan:    ${message.plan}` : '',
      `Sent at: ${message.createdAt}`,
      message.ip ? `IP:      ${message.ip}` : '',
      '',
      '---',
      message.message,
      '---',
      '',
      'Manage messages via the admin API: GET/PATCH/DELETE /api/messages',
    ]
      .filter(Boolean)
      .join('\n'),
  };

  await transporter.sendMail(mail);
}