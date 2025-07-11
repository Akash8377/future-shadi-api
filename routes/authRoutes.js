const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');

// Register route
router.post('/register', authValidator.validateRegister, authController.register);

// Login route
router.post('/login', authController.login);

module.exports = router;