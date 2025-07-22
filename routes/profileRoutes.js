// const express = require('express');
// const router = express.Router();
// const profileController = require('../controllers/profileController');
// const profileValidator = require('../validators/authValidator');
// const upload = require('../config/multer');
// const authMiddleware = require('../middlewares/authMiddleware'); // You'll need this

// // Register profile route
// router.post('/register', profileValidator.validateProfileRegister, profileController.registerProfile);
// router.post('/register', (req, res) => {
//   console.log('Register route hit!'); // Check server logs for this
//   res.json({ message: 'Profile register test successful' });
// });

// // Add new route for profile image upload
// router.post('/upload-image', authMiddleware, upload.single('profile'), profileController.uploadProfileImage);

// module.exports = router;


const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const profileValidator = require('../validators/authValidator');
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/authMiddleware');

// Register profile route
router.post('/register', profileValidator.validateProfileRegister, profileController.registerProfile);

// Add new route for profile image upload
router.post('/upload-image', authMiddleware, upload.single('profile'), profileController.uploadProfileImage);

// Partner preference routes
router.post('/partner-preference', authMiddleware, profileController.addPartnerPrefernce);
router.get('/partner-preference', authMiddleware, profileController.getPartnerPreference);
//  Send OTP for password reset
router.post('/send-otp', profileController.sendOtpToEmail);
 
// Verify OTP
router.post('/verify-otp', profileController.verifyOtp);
 
// Reset password using verified OTP
router.post('/reset-password', profileController.resetPassword);

module.exports = router;