const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

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
      income,
      workType,
      profession,
      profileDescription,
      excludeFromAffiliates,
      password
    } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (basic info)
    const userData = {
      firstName,
      lastName,
      email,
      password: hashedPassword
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
      income,
      work_type: workType,
      profession,
      profile_description: profileDescription,
      exclude_from_affiliates: excludeFromAffiliates
    };

    await User.createProfile(profileData);

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