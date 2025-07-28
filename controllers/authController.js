const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordEmail } = require('../services/otpService');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

exports.register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, lookingFor, dob, religion, education, country, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userData = {
      firstName,
      lastName,
      lookingFor,
      dob: new Date(dob),
      religion,
      education,
      country,
      email,
      password: hashedPassword
    };

    const userId = await User.create(userData);

    // Create JWT token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        firstName,
        lastName,
        email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.generateAndSendPassword = async (email) => {
  try {
    const crypto = require('crypto');
    const password = crypto.randomBytes(4).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.updatePasswordByEmail(email, hashedPassword);

    const { sendPasswordEmail } = require('../services/otpService');
    await sendPasswordEmail(email, password);

    return true;
  } catch (error) {
    console.error('Password generation error:', error);
    return false;
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists (including deleted accounts)
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is deleted but recoverable
    if (user.status === 'deleted') {
      const isRecoverable = new Date(user.deleted_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return res.status(403).json({ 
        message: 'Account deleted', 
        recoverable: isRecoverable 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(200).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.recoverAccount = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verify credentials first
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Attempt recovery
    const recovered = await User.recoverAccount(email);
    if (!recovered) {
      return res.status(400).json({ 
        message: 'Account cannot be recovered (either not deleted or recovery period expired)' 
      });
    }

    res.status(200).json({ success:true,message: 'Account recovered successfully' });
  } catch (error) {
    res.status(500).json({ success:false,message: 'Server error' });
  }
};

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Check if user exists
//     const user = await User.findByEmail(email);
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Check password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Create JWT token
//     const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
//       expiresIn: process.env.JWT_EXPIRE
//     });

//     res.status(200).json({
//       success: true,
//       token,
//       user
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };