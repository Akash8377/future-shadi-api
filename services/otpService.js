const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const OtpModel = require("../models/otpModel");

// Email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

module.exports = {
  generateAndSendEmailOTP: async (email) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Save OTP to DB
    await OtpModel.createOTP({
      contact: email,
      otp,
      type: "email",
      expiresAt,
    });

    const htmlTemplate = `
      <div style="max-width: 500px; margin: auto; padding: 20px; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://i.postimg.cc/dVrrNKYf/logo.png" alt="Logo" style="width: 182px;" />
          <h2 style="color: #333;">Email Verification</h2>
          <p style="font-size: 16px; color: #555;">Your One-Time Password (OTP) is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #2c3e50; margin: 20px 0;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire in 15 minutes. Please do not share it with anyone.</p>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 12px; color: #bbb;">If you did not request this code, please ignore this email.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is: ${otp}`,
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return otp;
  },

  verifyEmailOTP: async (email, otp) => {
    const storedOTP = await OtpModel.getValidOTP(email, "email");
    if (!storedOTP || storedOTP.otp !== otp) {
      return false;
    }
    await OtpModel.markAsUsed(storedOTP.id);
    return true;
  },

  generateAndSendPhoneOTP: async (phone) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    await OtpModel.createOTP({
      contact: phone,
      otp,
      type: "phone",
      expiresAt,
    });

    const twilioRes = await twilioClient.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });

    console.log("Twilio Response:", twilioRes.sid);
    return otp;
  },

  verifyPhoneOTP: async (phone, otp) => {
    const storedOTP = await OtpModel.getValidOTP(phone, "phone");
    if (!storedOTP || storedOTP.otp !== otp) {
      return false;
    }
    await OtpModel.markAsUsed(storedOTP.id);
    return true;
  },
  sendPasswordEmail: async (email, password) => {
    const htmlTemplate = `
      <div style="max-width: 500px; margin: auto; padding: 20px; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <img src="https://i.postimg.cc/dVrrNKYf/logo.png" alt="Logo" style="width: 182px;" />
          <h2 style="color: #333;">Your Account Password</h2>
          <p style="font-size: 16px; color: #555;">Your account has been successfully created.</p>
          <p style="font-size: 16px; color: #555;">Here are your login credentials:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <p style="font-size: 14px; color: #888;">Please change your password after first login.</p>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 12px; color: #bbb;">If you did not request this account, please contact support immediately.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your Account Password",
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
  }
};
