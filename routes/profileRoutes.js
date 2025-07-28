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

router.put('/update', authMiddleware, profileController.updateProfile);
router.get('/users-by-looking-for', profileController.getUsersByLookingFor);
router.get("/new-matches", profileController.newMatches);
router.get("/new-matches-near-me", profileController.newMatchesNearMe);

router.put('/update-email', authMiddleware, profileController.updateEmail);
router.get('/profile-settings', authMiddleware, profileController.getProfileSettings);
router.put('/profile-settings', authMiddleware, profileController.updateProfileSettings);
router.put('/astro-details', authMiddleware, profileController.updateAstroDetails);

router.get('/alert-settings', authMiddleware, profileController.getAlertSettings);
router.put('/alert-settings', authMiddleware, profileController.updateAlertSettings);

router.get('/privacy-settings', authMiddleware, profileController.getPrivacySettings);
router.put('/privacy-settings', authMiddleware, profileController.updatePrivacySettings);

router.get('/shadilive-preferences', authMiddleware, profileController.getShadiLivePreferences);
router.put('/shadilive-preferences', authMiddleware, profileController.updateShadiLivePreferences);

router.get('/status', authMiddleware, profileController.getProfileStatus);
router.put('/hide', authMiddleware, profileController.hideProfile);
router.delete('/', authMiddleware, profileController.deleteProfile);

// Matches route
router.get("/my-matches", profileController.myMatches);


module.exports = router;