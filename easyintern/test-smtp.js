import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

console.log("Using SMTP_USER:", SMTP_USER);

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const sendTestMail = async () => {
  try {
    const info = await transporter.sendMail({
      from: `"EzyIntern Test" <${SMTP_USER}>`,
      to: 'raunakkumarjob@gmail.com',
      subject: 'Test Email from API Setup',
      html: '<p>Hello!</p><p>This is a test email sent during the /api/send-mail setup process.</p>',
    });
    console.log("Email sent successfully: ", info.messageId);
  } catch (error) {
    console.error("Error sending test email:", error);
  }
};

sendTestMail();
