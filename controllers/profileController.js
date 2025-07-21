const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const path = require('path');
const fs = require('fs');
const otpService = require('../services/otpService');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

exports.registerProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      person,
      gender,
      firstName,
      lastName,
      birthDay,
      birthMonth,
      birthYear,
      religion,
      community,
      livingIn,
      email,
      phone,
      city,
      livesWithFamily,
      familyCity,
      subCommunity,
      maritalStatus,
      height,
      diet,
      qualification,
      college,
      incomePer,
      income,
      workType,
      profession,
      profileDescription,
      excludeFromAffiliates
    } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate random password
    const password = await User.generateRandomPassword();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (basic info)
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      religion,
      qualification,
      livingIn,
      birthDay,
      birthMonth,
      birthYear,
    };

    const userId = await User.create(userData);

    // Create profile (detailed info)
    const profileData = {
      user_id: userId,
      person,
      gender,
      birth_day: birthDay,
      birth_month: birthMonth,
      birth_year: birthYear,
      community,
      living_in: livingIn,
      phone,
      city,
      lives_with_family: livesWithFamily,
      family_city: familyCity,
      sub_community: subCommunity,
      marital_status: maritalStatus,
      height,
      diet,
      qualification,
      college,
      incomePer,
      income,
      work_type: workType,
      profession,
      profile_description: profileDescription,
      exclude_from_affiliates: excludeFromAffiliates,
    };

    await User.createProfile(profileData);

    // Send password email
   await otpService.sendPasswordEmail(email, password);

    // Create JWT token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        firstName,
        lastName,
        email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const userId = req.user.id;
    const imagePath = req.file.filename;

    // Update profile image in database
    const updated = await User.updateProfileImage(userId, imagePath);
    
    if (!updated) {
      // Delete the uploaded file if database update failed
      await unlinkAsync(path.join(__dirname, '../public/uploads/profiles', imagePath));
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update profile image' 
      });
    }

    res.status(200).json({
      success: true,
      imageUrl: `/uploads/profiles/${imagePath}`
    });

  } catch (error) {
    console.error('Profile image upload error:', error);
    
    // Clean up uploaded file if error occurred
    if (req.file) {
      try {
        await unlinkAsync(path.join(__dirname, '../public/uploads/profiles', req.file.filename));
      } catch (unlinkError) {
        console.error('Error cleaning up uploaded file:', unlinkError);
      }
    }

    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error during image upload' 
    });
  }
};

exports.deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Remove from database and get image path
    const imagePath = await User.deleteProfileImage(userId);
    
    if (!imagePath) {
      return res.status(404).json({ 
        success: false,
        message: 'No profile image found to delete' 
      });
    }

    // Delete the actual file
    const fullPath = path.join(__dirname, '../public/uploads/profiles', imagePath);
    if (fs.existsSync(fullPath)) {
      await unlinkAsync(fullPath);
    }

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    console.error('Profile image deletion error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error during image deletion' 
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await User.getProfile(userId);

    if (!profile) {
      return res.status(404).json({ 
        success: false,
        message: 'Profile not found' 
      });
    }

    // Construct full URL for profile image if it exists
    if (profile.profile_image) {
      profile.profile_image_url = `${req.protocol}://${req.get('host')}/uploads/profiles/${profile.profile_image}`;
    }

    res.status(200).json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error fetching profile' 
    });
  }
};

// exports.uploadProfileImage = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     const userId = req.user.id; // Assuming you have user ID from JWT
//     const imagePath = req.file.filename;

//     // Update user profile with image path
//     await pool.query(
//       'UPDATE profiles SET profile_image = ? WHERE user_id = ?',
//       [imagePath, userId]
//     );

//     res.status(200).json({
//       success: true,
//       imageUrl: `/uploads/profiles/${imagePath}`
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
