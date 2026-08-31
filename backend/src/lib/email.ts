import nodemailer from 'nodemailer';
import { logger } from './logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM_ADDRESS = process.env.SMTP_FROM || 'MyceliumOps <noreply@nexus.local>';
const APP_URL = process.env.APP_URL || 'http://localhost:5174';

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; font-size: 24px; font-weight: bold; line-height: 48px;">M</div>
      </div>
      <h2 style="color: #ffffff; text-align: center; margin-bottom: 16px;">Verify your email address</h2>
      <p style="color: #9ca3af; text-align: center; margin-bottom: 32px; line-height: 1.6;">
        Thanks for signing up for MyceliumOps. Please click the button below to verify your email address.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">
          Verify Email
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; text-align: center; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all;">${verifyUrl}</a>
      </p>
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 32px;">
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Verify your MyceliumOps account',
      html,
    });
    logger.info({ email }, 'Verification email sent');
  } catch (err) {
    logger.error({ email, err }, 'Failed to send verification email');
    throw new Error('Failed to send verification email');
  }
}
