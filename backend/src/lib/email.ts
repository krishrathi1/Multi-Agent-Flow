import { config } from '../config.js';
import nodemailer from 'nodemailer';
import { logger } from './logger.js';

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedEtherealAccount: nodemailer.TestAccount | null = null;

async function getTransporter(): Promise<{ transporter: nodemailer.Transporter; isEthereal: boolean }> {
  const smtp = config.smtp;
  const isCustomSmtp = Boolean(
    smtp.host &&
    smtp.host !== 'localhost' &&
    smtp.host !== '127.0.0.1' &&
    (smtp.user || smtp.pass || smtp.port !== 587)
  );

  // If real SMTP settings are provided, use them
  if (isCustomSmtp) {
    const hasAuth = Boolean(smtp.user && smtp.pass);
    const transportConfig: nodemailer.TransportOptions = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure || smtp.port === 465,
      auth: hasAuth ? { user: smtp.user, pass: smtp.pass } : undefined,
    } as any;

    return {
      transporter: nodemailer.createTransport(transportConfig),
      isEthereal: false,
    };
  }

  // If cached test transporter exists, reuse it
  if (cachedTransporter && cachedEtherealAccount) {
    return { transporter: cachedTransporter, isEthereal: true };
  }

  // Otherwise, automatically generate an Ethereal test mailbox for seamless zero-config testing
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedEtherealAccount = testAccount;
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    logger.info({ user: testAccount.user }, 'Initialized Ethereal email testing transport');
    return { transporter: cachedTransporter, isEthereal: true };
  } catch (err) {
    logger.warn({ err }, 'Could not create Ethereal test account, falling back to basic SMTP transport');
    return {
      transporter: nodemailer.createTransport({
        host: smtp.host || 'localhost',
        port: smtp.port || 587,
        secure: false,
      }),
      isEthereal: false,
    };
  }
}

export async function sendVerificationEmail(email: string, token: string, otp?: string): Promise<string> {
  const appUrl = config.appUrl.replace(/\/$/, '');
  const verifyUrl = `${appUrl}/verify-email?token=${token}${otp ? `&otp=${otp}` : ''}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your email address</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 16px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05); overflow: hidden;">
              <!-- Header / Logo -->
              <tr>
                <td align="center" style="padding: 36px 32px 20px 32px;">
                  <div style="display: inline-block; width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-size: 26px; font-weight: bold; line-height: 52px; text-align: center;">
                    M
                  </div>
                </td>
              </tr>
              <!-- Heading -->
              <tr>
                <td align="center" style="padding: 0 32px;">
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.02em;">
                    Verify your email address
                  </h1>
                  <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                    Thanks for signing up for <strong>MyceliumOps</strong>! Enter the 6-digit verification code below or click the button to activate your account.
                  </p>
                </td>
              </tr>
              <!-- OTP Box -->
              ${otp ? `
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0;">
                      Verification Code (OTP)
                    </p>
                    <div style="color: #15803d; font-size: 38px; font-weight: 800; letter-spacing: 0.25em; font-family: Consolas, monospace; line-height: 1.2; margin: 0 0 8px 0;">
                      ${otp}
                    </div>
                    <p style="color: #4b5563; font-size: 12px; margin: 0;">
                      Enter this code on the verification screen to activate your account.
                    </p>
                  </div>
                </td>
              </tr>
              ` : ''}
              <!-- CTA Button -->
              <tr>
                <td align="center" style="padding: 0 32px 28px 32px;">
                  <a href="${verifyUrl}" target="_blank" style="display: inline-block; padding: 13px 36px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                    Verify Email Address
                  </a>
                </td>
              </tr>
              <!-- Link Fallback -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                    <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0; font-weight: 500;">
                      Button not working? Copy and paste this link in your browser:
                    </p>
                    <a href="${verifyUrl}" style="color: #2563eb; font-size: 12px; word-break: break-all; text-decoration: underline;">
                      ${verifyUrl}
                    </a>
                  </div>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
                  <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                    This link and OTP will expire in 24 hours.<br />
                    If you did not sign up for an account, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    let { transporter, isEthereal } = await getTransporter();
    const fromAddress = config.smtp.from || (isEthereal ? '"MyceliumOps" <no-reply@ethereal.email>' : '"MyceliumOps" <no-reply@myceliumops.com>');
    const subject = otp ? `${otp} is your MyceliumOps verification code` : 'Verify your MyceliumOps account';

    let info;
    try {
      info = await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html,
      });
    } catch (smtpErr) {
      if (!isEthereal) {
        logger.warn({ smtpErr }, 'Custom SMTP send failed, falling back to Ethereal test transport');
        const testAccount = await nodemailer.createTestAccount();
        const fallbackTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        info = await fallbackTransporter.sendMail({
          from: '"MyceliumOps" <no-reply@ethereal.email>',
          to: email,
          subject,
          html,
        });
      } else {
        throw smtpErr;
      }
    }

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`\n======================================================`);
    console.log(`✉️  NEW VERIFICATION EMAIL SENT!`);
    console.log(`   To: ${email}`);
    if (otp) console.log(`   🔑 Verification OTP: >>> ${otp} <<<`);
    console.log(`   Direct Link: ${verifyUrl}`);
    if (previewUrl) console.log(`   Ethereal Preview: ${previewUrl}`);
    console.log(`======================================================\n`);

    if (previewUrl) {
      logger.info({ email, previewUrl, verifyUrl, otp }, 'Verification email sent via Ethereal test service');
    } else {
      logger.info({ email, messageId: info.messageId, otp }, 'Verification email sent via SMTP successfully');
    }

    return verifyUrl;
  } catch (err) {
    logger.error({ email, err }, 'Failed to send verification email');
    throw new Error('Failed to send verification email');
  }
}
