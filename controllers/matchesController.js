const Matches = require("../models/matchesModel");
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
    const {  user_id, looking_for, partner_preference, ...filters } = req.query;
 
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
    const users = await Matches.getMyMatches(
      looking_for,
      processedFilters,
      parsedPreference,
      user_id
    );
 
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.newMatches = async (req, res) => {
  try {
    const { user_id, looking_for, ...filters } = req.query;
 
    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }
 
    const processedFilters = {};
 
    for (let [key, value] of Object.entries(filters)) {
      // Remove brackets from keys like verificationStatus[]
      key = key.replace(/\[\]$/, '');
 
      // Convert comma-separated strings to arrays
      if (typeof value === 'string') {
        value = value.split(',');
      }
 
      // Ignore "all"
      if (value.includes('all')) continue;
 
      processedFilters[key] = value;
    }
 
   const users = await Matches.getNewMatchesByLookingFor(looking_for, processedFilters, user_id);

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.newMatchesNearMe = async (req, res) => {
  try {
    const { user_id, looking_for, nearMe, ...filters } = req.query;

    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }
    const processedFilters = {};
 
    for (let [key, value] of Object.entries(filters)) {
      // Remove brackets from keys like verificationStatus[]
      key = key.replace(/\[\]$/, '');
 
      // Convert comma-separated strings to arrays
      if (typeof value === 'string') {
        value = value.split(',');
      }
 
      // Ignore "all"
      if (value.includes('all')) continue;
 
      processedFilters[key] = value;
    }


    const users = await Matches.getNewMatchesByNearMe(looking_for, nearMe, processedFilters, user_id);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
 
exports.getShortlisted = async (req, res) => {
  try {
    const { user_id, looking_for, ...filters } = req.query;

    if (!looking_for || !["Bride", "Groom"].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }

    const processedFilters = {};

    for (let [key, value] of Object.entries(filters)) {
      key = key.replace(/\[\]$/, "");

      if (typeof value === "string") {
        value = value.split(",");
      }

      if (value.includes("all")) continue;

      processedFilters[key] = value;
    }

    const users = await Matches.getShortlisted(looking_for, processedFilters, user_id);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching shortlisted matches:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};