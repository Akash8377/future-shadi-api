const User = require("../models/userModel");
const OtpService = require("../services/otpService");
const { validationResult } = require("express-validator");

exports.sendEmailOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    
    // Check if email is already verified/registered
    const existingUser = await User.findByEmail(email);
    if (existingUser && existingUser.email_verified) {
      return res.status(400).json({ 
        success: false,
        message: "Email is already registered" 
      });
    }

    // Generate and send OTP
    const otp = await OtpService.generateAndSendEmailOTP(email);

    res.status(200).json({
      success: true,
      message: "OTP sent to email successfully"
    });
  } catch (error) {
    console.error("Email OTP error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to send email OTP" 
    });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;
    
    // Verify OTP
    const isValid = await OtpService.verifyEmailOTP(email, otp);
    if (!isValid) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid OTP" 
      });
    }

    // Mark email as verified in database
    await User.markEmailAsVerified(email);

    res.status(200).json({
      success: true,
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to verify email" 
    });
  }
};

exports.sendPhoneOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone } = req.body;
    
    // Check if phone is already verified/registered
    const existingUser = await User.findByPhone(phone);
    if (existingUser && existingUser.phone_verified) {
      return res.status(400).json({ 
        success: false,
        message: "Phone is already verified" 
      });
    }

    // Generate and send OTP
    const otp = await OtpService.generateAndSendPhoneOTP(phone);

    res.status(200).json({
      success: true,
      message: "OTP sent to phone successfully"
    });
  } catch (error) {
    console.error("Phone OTP error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to send phone OTP" 
    });
  }
};

exports.verifyPhoneOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("1", errors)
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, otp } = req.body;
    
    // Verify OTP
    const isValid = await OtpService.verifyPhoneOTP(phone, otp);
    if (!isValid) {
      console.log("2 valid", isValid)
      return res.status(400).json({ 
        success: false,
        message: "Invalid OTP" 
      });
    }

    // Mark phone as verified in database
    await User.markPhoneAsVerified(phone);

    res.status(200).json({
      success: true,
      message: "Phone verified successfully"
    });
  } catch (error) {
    console.error("Phone verification error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to verify phone" 
    });
  }
};