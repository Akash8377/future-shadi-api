const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const authMiddleware = require('../middleware/authMiddleware');
const verificationValidator = require('../validators/verificationValidator');

// Protected verification routes
router.post('/pan', 
  authMiddleware, 
  verificationValidator.validatePAN, 
  verificationController.verifyPAN
);

router.post('/aadhaar', 
  authMiddleware, 
  verificationValidator.validateAadhaar, 
  verificationController.verifyAadhaar
);

router.post('/dl', 
  authMiddleware, 
  verificationValidator.validateDL, 
  verificationController.verifyDrivingLicense
);

module.exports = router;