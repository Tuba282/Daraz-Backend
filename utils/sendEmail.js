const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  };

  await transporter.sendMail(mailOptions);
};

// Email templates
const emailTemplates = {
  passwordReset: (name, resetUrl) => ({
    subject: 'Password Reset Request — Daraz Clone',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#f85606;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">🛒 Daraz Clone</h1>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <h2 style="color:#333;">Password Reset Request</h2>
          <p style="color:#666;">Hello <strong>${name}</strong>,</p>
          <p style="color:#666;">We received a request to reset your password. Click the button below to reset it.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${resetUrl}" style="background:#f85606;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color:#999;font-size:13px;">This link will expire in 15 minutes.</p>
          <p style="color:#999;font-size:13px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>
    `,
  }),

  orderConfirmation: (name, order) => ({
    subject: `Order Confirmed #${order.orderNumber} — Daraz Clone`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#f85606;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">🛒 Daraz Clone</h1>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <h2 style="color:#333;">Order Confirmed! 🎉</h2>
          <p style="color:#666;">Hello <strong>${name}</strong>,</p>
          <p style="color:#666;">Your order <strong>#${order.orderNumber}</strong> has been placed successfully.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#f5f5f5;">
              <th style="padding:10px;text-align:left;border:1px solid #ddd;">Item</th>
              <th style="padding:10px;text-align:right;border:1px solid #ddd;">Qty</th>
              <th style="padding:10px;text-align:right;border:1px solid #ddd;">Price</th>
            </tr>
            ${order.items
              .map(
                (item) => `
              <tr>
                <td style="padding:10px;border:1px solid #ddd;">${item.name}</td>
                <td style="padding:10px;text-align:right;border:1px solid #ddd;">${item.quantity}</td>
                <td style="padding:10px;text-align:right;border:1px solid #ddd;">Rs. ${(item.price * item.quantity).toLocaleString()}</td>
              </tr>`
              )
              .join('')}
            <tr style="font-weight:bold;">
              <td colspan="2" style="padding:10px;border:1px solid #ddd;">Total</td>
              <td style="padding:10px;text-align:right;border:1px solid #ddd;">Rs. ${order.totalAmount.toLocaleString()}</td>
            </tr>
          </table>
          <p style="color:#666;">Payment Method: <strong>${order.paymentMethod.toUpperCase()}</strong></p>
          <p style="color:#999;font-size:13px;">Thank you for shopping with Daraz Clone!</p>
        </div>
      </div>
    `,
  }),

  welcomeEmail: (name) => ({
    subject: 'Welcome to Daraz Clone! 🛒',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#f85606;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">🛒 Daraz Clone</h1>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <h2 style="color:#333;">Welcome, ${name}! 🎉</h2>
          <p style="color:#666;">Your account has been created successfully. Start shopping for great deals today!</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background:#f85606;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              Start Shopping
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  welcomeEmailVendor: (name) => ({
    subject: 'Welcome to Daraz Seller Center! 🏬',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#f85606;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">🏬 Daraz Seller Center</h1>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <h2 style="color:#333;">Welcome, ${name}! 🤝</h2>
          <p style="color:#666;">Your seller account has been registered successfully. You can now setup your store, add products, and start selling!</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.CLIENT_URL}/vendor/login" style="background:#1a9cb7;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              Login to Seller Center
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  adminAlertNewVendor: (vendorName, vendorEmail) => ({
    subject: '🚨 New Vendor Registration Alert',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">🛡️ Admin Portal Alert</h1>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <h2 style="color:#333;">New Vendor Registration</h2>
          <p style="color:#666;">A new vendor has just registered on the platform.</p>
          <ul style="color:#666;line-height:1.6;">
             <li><strong>Name:</strong> ${vendorName}</li>
             <li><strong>Email:</strong> ${vendorEmail}</li>
          </ul>
          <p style="color:#666;">Please login to the Admin Portal to review their store application.</p>
        </div>
      </div>
    `,
  }),
};

module.exports = { sendEmail, emailTemplates };
