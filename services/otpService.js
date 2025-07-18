const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const OtpModel = require("../models/otpModel");

// Configure these in your .env file
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

module.exports = {
  generateAndSendEmailOTP: async (email) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Save OTP to database
    await OtpModel.createOTP({
      contact: email,
      otp,
      type: "email",
      expiresAt,
    });

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is: ${otp}`,
      html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
    };

    await transporter.sendMail(mailOptions);
    return otp;
  },

  verifyEmailOTP: async (email, otp) => {
    const storedOTP = await OtpModel.getValidOTP(email, "email");
    if (!storedOTP || storedOTP.otp !== otp) {
      return false;
    }

    // Mark OTP as used
    await OtpModel.markAsUsed(storedOTP.id);
    return true;
  },

  generateAndSendPhoneOTP: async (phone) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Save OTP to database
    await OtpModel.createOTP({
      contact: phone,
      otp,
      type: "phone",
      expiresAt,
    });

    // Send SMS
    const twilioRes = await twilioClient.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });
    console.log("twilioRes", twilioRes)

    return otp;
  },

  verifyPhoneOTP: async (phone, otp) => {
    const storedOTP = await OtpModel.getValidOTP(phone, "phone");
    if (!storedOTP || storedOTP.otp !== otp) {
      return false;
    }

    // Mark OTP as used
    await OtpModel.markAsUsed(storedOTP.id);
    return true;
  },
};