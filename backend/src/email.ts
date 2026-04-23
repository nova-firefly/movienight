import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  ...(process.env.SMTP_USER
    ? {
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        },
      }
    : {}),
});

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@movienight.local';

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}?resetToken=${resetToken}`;

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'MovieNight - Password Reset',
    text: [
      'You requested a password reset for your MovieNight account.',
      '',
      `Click this link to reset your password (expires in 1 hour):`,
      resetLink,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your MovieNight account.</p>
      <p><a href="${resetLink}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}
