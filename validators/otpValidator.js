const { body, param, query } = require('express-validator');
const User = require('../models/userModel');

// Common validation rules
const emailValidation = body('email')
  .trim()
  .notEmpty().withMessage('Email is required')
  .isEmail().withMessage('Invalid email format')
  .normalizeEmail();

const phoneValidation = body('phone')
  .trim()
  .notEmpty().withMessage('Phone number is required')
  .isMobilePhone().withMessage('Invalid phone number format');

const otpValidation = body('otp')
  .trim()
  .notEmpty().withMessage('OTP is required')
  .isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
  .isNumeric().withMessage('OTP must contain only numbers');

// Validator for sending email OTP
exports.validateSendEmailOTP = [
  emailValidation,
  body('email').custom(async (email) => {
    const user = await User.findByEmail(email);
    if (user && user.email_verified) {
      throw new Error('Email is already verified');
    }
    return true;
  })
];

// Validator for verifying email OTP
exports.validateVerifyEmailOTP = [
  emailValidation,
  otpValidation
];

// Validator for sending phone OTP
exports.validateSendPhoneOTP = [
  phoneValidation,
  body('phone').custom(async (phone) => {
    const user = await User.findByPhone(phone);
    if (user && user.phone_verified) {
      throw new Error('Phone is already verified');
    }
    return true;
  })
];

// Validator for verifying phone OTP
exports.validateVerifyPhoneOTP = [
  phoneValidation,
  otpValidation
];

// Validator for checking verification status
exports.validateVerificationStatus = [
  param('type').isIn(['email', 'phone']).withMessage('Invalid verification type'),
  param('identifier')
    .notEmpty().withMessage('Identifier is required')
    .custom(async (identifier, { req }) => {
      if (req.params.type === 'email') {
        if (!identifier.includes('@')) {
          throw new Error('Invalid email format');
        }
        const user = await User.findByEmail(identifier);
        if (!user) {
          throw new Error('Email not found');
        }
      } else {
        if (isNaN(identifier)) {
          throw new Error('Invalid phone format');
        }
        const user = await User.findByPhone(identifier);
        if (!user) {
          throw new Error('Phone not found');
        }
      }
      return true;
    })
];