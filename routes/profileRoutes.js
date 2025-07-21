const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const profileValidator = require('../validators/authValidator');
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/authMiddleware'); // You'll need this

// Register profile route
router.post('/register', profileValidator.validateProfileRegister, profileController.registerProfile);
router.post('/register', (req, res) => {
  console.log('Register route hit!'); // Check server logs for this
  res.json({ message: 'Profile register test successful' });
});

// Add new route for profile image upload
router.post('/upload-image', authMiddleware, upload.single('profile'), profileController.uploadProfileImage);

module.exports = router;