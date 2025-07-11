const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const profileValidator = require('../validators/authValidator');

// Register profile route
router.post('/register', profileValidator.validateProfileRegister, profileController.registerProfile);

module.exports = router;