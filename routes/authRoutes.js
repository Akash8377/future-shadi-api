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
router.post('/send-email-otp', otpController.sendEmailOTP);
router.post('/verify-email-otp', otpController.verifyEmailOTP);
router.post('/send-phone-otp', otpController.sendPhoneOTP);
router.post('/verify-phone-otp', otpController.verifyPhoneOTP);
router.post('/generate-password', async (req, res) => {
  try {
    const { email } = req.body;
    const success = await authController.generateAndSendPassword(email);
    
    if (success) {
      res.status(200).json({ message: 'Password generated and sent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to generate password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/recover', authController.recoverAccount);

module.exports = router;