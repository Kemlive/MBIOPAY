import nodemailer from "nodemailer";

const DEV_MODE = !process.env.SMTP_HOST;

function createTransport() {
  if (DEV_MODE) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? "MBIO Pay <noreply@mbiopay.com>";

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111118;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d2d1a,#0a1f13);padding:24px 32px;border-bottom:1px solid #1e1e2e;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="color:#00c853;font-size:22px;font-weight:700;letter-spacing:-0.5px;">MBIO<span style="color:#e8f5e9;margin-left:4px;">PAY</span></td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <p style="color:#a0a0b0;font-size:14px;margin:0 0 8px;">Email Verification</p>
          <h2 style="color:#e8f5e9;font-size:20px;margin:0 0 24px;font-weight:600;">Verify your email address</h2>
          <p style="color:#a0a0b0;font-size:14px;line-height:1.6;margin:0 0 28px;">
            Enter the following 6-digit code in the MBIO PAY app to verify your email. This code expires in <strong style="color:#e8f5e9;">15 minutes</strong>.
          </p>
          <div style="background:#0d2d1a;border:2px solid #00c853;border-radius:12px;padding:20px;text-align:center;margin:0 0 28px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#00c853;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#606070;font-size:12px;line-height:1.6;margin:0 0 12px;">
            If you did not create an account on MBIO PAY, you can safely ignore this email.
          </p>
          <p style="color:#a0a0b0;font-size:12px;line-height:1.6;margin:0 0 16px;background:#1a1a2e;border-left:3px solid #00c853;padding:10px 14px;border-radius:4px;">
            MBIO Pay will never ask for this code outside the app.
          </p>
          <div style="border-top:1px solid #1e1e2e;padding-top:16px;margin-top:8px;">
            <p style="color:#404050;font-size:11px;margin:0;">© 2026 MBIO PAY · Secure digital transfer service</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  if (DEV_MODE) {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║  📧  EMAIL VERIFICATION CODE          ║`);
    console.log(`║  To: ${email.padEnd(32)}║`);
    console.log(`║  Code: ${code.padEnd(30)}║`);
    console.log(`╚══════════════════════════════════════╝\n`);
    return;
  }

  const transporter = createTransport()!;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Your MBIO PAY verification code",
    html,
    text: `Your MBIO PAY verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not sign up, please ignore this email.`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `https://mbiopay.com/auth?reset=${token}`;

  if (DEV_MODE) {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║  🔑  PASSWORD RESET                   ║`);
    console.log(`║  To: ${email.padEnd(32)}║`);
    console.log(`║  URL: ${resetUrl.slice(0, 31).padEnd(31)}║`);
    console.log(`╚══════════════════════════════════════╝\n`);
    return;
  }

  const transporter = createTransport()!;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your MBIO PAY password",
    text: `You requested a password reset for your MBIO PAY account.\n\nClick the link below to set a new password. The link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request a password reset, ignore this email — your account is safe.`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111118;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d2d1a,#0a1f13);padding:24px 32px;border-bottom:1px solid #1e1e2e;">
            <span style="color:#00c853;font-size:22px;font-weight:700;">MBIO<span style="color:#e8f5e9;margin-left:4px;">PAY</span></span>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <p style="color:#a0a0b0;font-size:14px;margin:0 0 8px;">Password Reset</p>
          <h2 style="color:#e8f5e9;font-size:20px;margin:0 0 16px;font-weight:600;">Reset your password</h2>
          <p style="color:#a0a0b0;font-size:14px;line-height:1.6;margin:0 0 28px;">
            We received a request to reset the password for your MBIO PAY account. Click the button below to choose a new password. This link expires in <strong style="color:#e8f5e9;">1 hour</strong>.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${resetUrl}" style="display:inline-block;background:#00c853;color:#0a0f0a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
              Reset Password
            </a>
          </div>
          <p style="color:#606070;font-size:12px;line-height:1.6;margin:0 0 12px;">
            If the button does not work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color:#00c853;word-break:break-all;">${resetUrl}</a>
          </p>
          <p style="color:#a0a0b0;font-size:12px;line-height:1.6;margin:0 0 16px;background:#1a1a2e;border-left:3px solid #00c853;padding:10px 14px;border-radius:4px;">
            If you did not request a password reset, ignore this email — your account is safe. MBIO Pay will never ask for your password over email.
          </p>
          <div style="border-top:1px solid #1e1e2e;padding-top:16px;margin-top:8px;">
            <p style="color:#404050;font-size:11px;margin:0;">© 2026 MBIO PAY · Secure digital transfer service</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendTwoFADisabledEmail(email: string): Promise<void> {
  if (DEV_MODE) {
    console.log(`[EMAIL] 2FA disabled notification sent to ${email}`);
    return;
  }

  const transporter = createTransport()!;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "2FA has been disabled on your MBIO PAY account",
    text: `Two-factor authentication has been disabled on your MBIO PAY account.\n\nIf this was not you, contact support immediately at +1 213-510-5113.`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111118;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2d0d0d,#1f0a0a);padding:24px 32px;border-bottom:1px solid #1e1e2e;">
          <span style="color:#ff4444;font-size:22px;font-weight:700;">MBIO<span style="color:#e8f5e9;margin-left:4px;">PAY</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#ff4444;font-size:13px;font-weight:600;margin:0 0 8px;">⚠ Security Alert</p>
          <h2 style="color:#e8f5e9;font-size:18px;margin:0 0 16px;">Two-Factor Authentication Disabled</h2>
          <p style="color:#a0a0b0;font-size:14px;line-height:1.6;margin:0 0 20px;">
            Two-factor authentication was just disabled on your MBIO PAY account. If this was you, no action is needed. If you did not make this change, please contact support immediately.
          </p>
          <a href="tel:+12135105113" style="color:#00c853;font-weight:600;">+1 213-510-5113</a>
          <div style="border-top:1px solid #1e1e2e;padding-top:16px;margin-top:24px;">
            <p style="color:#404050;font-size:11px;margin:0;">© 2026 MBIO PAY</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
