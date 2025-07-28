const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const path = require('path');
const fs = require('fs');
const otpService = require('../services/otpService');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const {generateAndSendEmailOTP, verifyEmailOTP} = require('../services/otpService')

exports.myMatches  = async (req, res) => {
  try {
    const { looking_for, partner_preference, ...filters } = req.query;
 
    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }
 
    const processedFilters = {};
 
    for (let [key, value] of Object.entries(filters)) {
      key = key.replace(/\[\]$/, '');
      if (typeof value === 'string') {
        value = value.split(',');
      }
      if (value.includes('all')) continue;
      processedFilters[key] = value;
    }
 
    let parsedPreference = null;
    if (partner_preference) {
      try {
        parsedPreference = JSON.parse(partner_preference);
      } catch (e) {
        console.warn("Invalid partner_preference format", e);
      }
    }
 
    console.log(parsedPreference, "parsedPreference");
    const users = await User.getMyMatches(
      looking_for,
      processedFilters,
      parsedPreference
    );
 
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
 