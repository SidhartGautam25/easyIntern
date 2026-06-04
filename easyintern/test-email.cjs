// Test email script - run with: node test-email.js
// This sends a test email using the SMTP credentials directly

const nodemailer = require('nodemailer');

async function sendTestEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: 'noreply@ezyintern.in',
      pass: 'Ezyintern@Bhopal&2026',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"EzyIntern" <noreply@ezyintern.in>',
      to: 'raunakkumarjob@gmail.com',
      subject: '✅ EzyIntern Email Test — System Working!',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f0f4f8; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 40px 32px; text-align: center;">
      <h1 style="color: white; font-size: 28px; margin: 0;">🎉 Email System Working!</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 15px;">EzyIntern Official Mail Server</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #475569; line-height: 1.6;">This is a <strong>test email</strong> from the EzyIntern email system.</p>
      <p style="font-size: 16px; color: #475569; line-height: 1.6;">
        If you received this email, the SMTP configuration is <strong style="color: #059669;">working correctly</strong>.<br>
        Students will now receive registration confirmations and certificate notifications from this email.
      </p>
      <div style="background: #EEF2FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #4F46E5; font-weight: 700;">📧 Sent from: noreply@ezyintern.in</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #4F46E5;">🕐 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">EzyIntern — Official Internship Programme | www.ezyintern.com</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Delivered to: raunakkumarjob@gmail.com');
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    if (error.code === 'EAUTH') {
      console.error('   → Authentication failed. Check email/password.');
    } else if (error.code === 'ECONNECTION') {
      console.error('   → Could not connect to SMTP server. Check host/port.');
    }
  }
}

sendTestEmail();
