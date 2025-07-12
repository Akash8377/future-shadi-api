const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const otpController = require('../controllers/otpController');
const otpValidator = require('../validators/otpValidator');

// Register route
router.post('/register', authValidator.validateRegister, authController.register);

// Login route
router.post('/login', authController.login);

// OTP Routes
router.post('/send-email-otp', otpValidator.validateSendEmailOTP, otpController.sendEmailOTP);
router.post('/verify-email-otp', otpValidator.validateVerifyEmailOTP, otpController.verifyEmailOTP);
router.post('/send-phone-otp', otpValidator.validateSendPhoneOTP, otpController.sendPhoneOTP);
router.post('/verify-phone-otp', otpValidator.validateVerifyPhoneOTP, otpController.verifyPhoneOTP);

module.exports = router;