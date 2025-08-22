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
      excludeFromAffiliates,
      motherTongue,
      email_verified = 1,
      phone_verified = 0,
      lookingFor
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
      email_verified,
      phone_verified,
      lookingFor
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
      mother_tongue: motherTongue,
    };

    await User.createProfile(profileData);

    // Send password email
   await otpService.sendPasswordEmail(email, password);

    // Create JWT token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.status(201).json({
      success: true,
      token,
      user,
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
      imageUrl: imagePath
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

exports.addPartnerPrefernce = async (req, res) => {
  try {
    const userId = req.user.id;
    const { partnerPreference } = req.body;

    // Validate partner preference data
    if (!partnerPreference || typeof partnerPreference !== 'object') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid partner preference data' 
      });
    }

    // Update partner preference in database
    const updated = await User.updatePartnerPreference(userId, partnerPreference);
    
    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update partner preference' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Partner preference updated successfully'
    });

  } catch (error) {
    console.error('Add partner preference error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating partner preference' 
    });
  }
};

exports.addPartnerPrefernce = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
     basic, community,education, location,otherDetails,familyDetails,financialStatus,hobbies,verificationData, onlyPartnerPrefrence = false
    } = req.body;

    // Validate required fields
    if(!onlyPartnerPrefrence){
      if (!basic || !community || !education || !location || !otherDetails || !familyDetails || !financialStatus || !hobbies || !verificationData) {
        return res.status(400).json({ 
          success: false,
          message: 'Required fields are missing' 
        });
      }
    }

    // Prepare partner preference data
    const partnerPreference = {
     basic, community, education, location, otherDetails
    };

    // Update partner preference in database
let updated = {};
    if(!onlyPartnerPrefrence){
      updated = await User.updatePartnerPreference(
      userId,
      partnerPreference,
      verificationData, 
      hobbies,
      financialStatus,
      familyDetails,
    );
    }else{
      updated = await User.updateOnlyPartnerPreference( userId, partnerPreference );
    }
    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update partner preference' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Partner preference updated successfully'
    });

  } catch (error) {
    console.error('Add partner preference error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating partner preference' 
    });
  }
};

exports.getPartnerPreference = async (req, res) => {
  try {
    const userId = req.user.id;
    const preference = await User.getPartnerPreference(userId);

    if (!preference) {
      return res.status(404).json({ 
        success: false,
        message: 'Partner preference not found' 
      });
    }

    res.status(200).json({
      success: true,
      preference
    });

  } catch (error) {
    console.error('Get partner preference error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error fetching partner preference' 
    });
  }
};

exports.sendOtpToEmail = async (req, res) => {
  try {
    const { email } = req.body;
 
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
 
    await generateAndSendEmailOTP(email);
 
    return res.json({ message: "OTP sent successfully to email" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};
 
/**
 * Verify OTP
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
 
    const isValid = await verifyEmailOTP(email, otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
 
    return res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("OTP verification failed:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
 
/**
 * Reset password after verifying OTP
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
 
    const isValid = await verifyEmailOTP(email, otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
 
    await User.updatePasswordByEmail(email, hashedPassword);
 
    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      // Basic info
      firstName,
      lastName,
      phone,
      
      // Profile info
      person,
      gender,
      birthDay,
      birthMonth,
      birthYear,
      community,
      livingIn,
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
      profile_description,
      excludeFromAffiliates,
      
      // New fields
      blood_group,
      health_info,
      disability,
      gothra,
      mother_tongue,
      birth_time,
      birth_city,
      manglik,
      employer,
      
      // JSON fields
      hobbies,
      financial_status,
      family_details,
      verificationData
    } = req.body;

    // Update user table (basic info)
    if (firstName || lastName || phone) {
      await User.updateBasicInfo(userId, {
        firstName,
        lastName,
        phone
      });
    }

    // Prepare profile update data
    const profileData = {
      // Existing fields
      person,
      gender,
      birth_day: birthDay,
      birth_month: birthMonth,
      birth_year: birthYear,
      community,
      living_in: livingIn,
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
      profile_description: profile_description,
      exclude_from_affiliates: excludeFromAffiliates,
      
      // New fields
      blood_group: blood_group,
      health_info: health_info,
      disability,
      gothra,
      mother_tongue: mother_tongue,
      birth_time: birth_time,
      birth_city: birth_city,
      manglik,
      employer,
      
      // JSON fields
      hobbies: hobbies ? JSON.stringify(hobbies) : undefined,
      financial_status: financial_status,
      family_details: family_details ? JSON.stringify(family_details) : undefined,
      verificationData: verificationData ? JSON.stringify(verificationData) : undefined
    };

    // Remove undefined values
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined) {
        delete profileData[key];
      }
    });

    // Update profile
    const updated = await User.updateProfile(userId, profileData);
    
    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update profile' 
      });
    }

    // Get updated profile to return
    const updatedProfile = await User.getProfile(userId);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating profile' 
    });
  }
};

exports.getUsersByLookingFor = async (req, res) => {
  try {
    const {id, looking_for } = req.query;
 
    if (!looking_for || !['Bride', 'Groom'].includes(looking_for)) {
      return res.status(400).json({ message: "Invalid 'looking_for' value" });
    }

    const users = await User.getUsersByLookingFor(id, looking_for);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
 
exports.updateEmail = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from auth middleware
    const { newEmail } = req.body;

    // Validate input
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    // Update email in database
    const updated = await User.updateEmail(userId, newEmail);
    
    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update email' 
      });
    }

    // Send verification email (optional - if you want to require re-verification)
    await generateAndSendEmailOTP(newEmail);

    res.status(200).json({
      success: true,
      message: 'Email updated successfully. Please verify your new email.',
      email: newEmail
    });

  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating email' 
    });
  }
};
 
exports.getProfileSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await User.getProfileSettings(userId);

    res.status(200).json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Get contact settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error getting contact settings' 
    });
  }
};

exports.updateProfileSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, contactStatus = 'allMatches', astro_display_status} = req.body;

    // Validate which type of update is being requested
    if (contactStatus) {
      // Validate contact status
      const validContactStatuses = ['premiumMembers', 'premiumLiked', 'noOne', 'allMatches'];
      if (!validContactStatuses.includes(contactStatus)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid contact status' 
        });
      }
    }

    if (astro_display_status) {
      // Validate astro display status
      const validAstroStatuses = ['visibleToALL', 'visibleToContactedAndAccepted', 'hideFromALL'];
      if (!validAstroStatuses.includes(astro_display_status)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid astro display status' 
        });
      }
    }

    // Update in database
    const updated = await User.updateProfileSettings(userId, {
      phone,
      contactStatus,
      astro_display_status
    });

    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update profile settings' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile settings updated successfully'
    });

  } catch (error) {
    console.error('Update profile settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating profile settings' 
    });
  }
};
exports.updateAstroDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      birth_time,
      birth_city,
      manglik,
      nakshatra,
      rashi
    } = req.body;

    // Basic validation
    if (!birth_time || !birth_city) {
      return res.status(400).json({
        success: false,
        message: 'Birth time and city are required'
      });
    }

    // Update in database
    const updated = await User.updateAstroDetails(userId, {
      birth_time,
      birth_city,
      manglik,
      nakshatra,
      rashi
    });

    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update astro details' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Astro details updated successfully'
    });

  } catch (error) {
    console.error('Update astro details error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating astro details' 
    });
  }
};

exports.getAlertSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await User.getAlertSettings(userId);
    
    res.status(200).json({
      success: true,
      settings: settings || {
        matchMail: 'daily',
        broaderMatches: true,
        premiumMatch: 'weekly',
        recentVisitors: 'weekly',
        shortlisted: 'weekly',
        viewedProfile: 'weekly',
        similarProfile: 'biweekly',
        contactAlert: 'instant',
        messageReceived: 'unsubscribe',
        smsInvitations: true,
        smsAcceptInvitations: false,
        profileBlaster: 'unsubscribe',
        shadiSpecials: false,
        shadiInsite: false
      }
    });
  } catch (error) {
    console.error('Get alert settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error getting alert settings' 
    });
  }
};

exports.updateAlertSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    const updated = await User.updateAlertSettings(userId, settings);

    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update alert settings' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Alert settings updated successfully'
    });
  } catch (error) {
    console.error('Update alert settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating alert settings' 
    });
  }
};


exports.getPrivacySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await User.getPrivacySettings(userId);
    
    res.status(200).json({
      success: true,
      settings: settings || {
        displayName: 'hideLast',
        phone: 'premiumMembers',
        email: 'premiumMembers',
        dob: 'full',
        income: 'visible',
        shortlist: 'show',
        dnd: true,
        profilePrivacy: 'allVisitors'
      }
    });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error getting privacy settings' 
    });
  }
};

exports.updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    const updated = await User.updatePrivacySettings(userId, settings);

    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update privacy settings' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated successfully'
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating privacy settings' 
    });
  }
};

exports.getShadiLivePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await User.getShadiLivePreferences(userId);
    
    res.status(200).json({
      success: true,
      preferences: preferences || {
        pushNotification: true,
        email: true,
        sms: true,
        whatsapp: true,
        call: true
      }
    });
  } catch (error) {
    console.error('Get ShadiLive preferences error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error getting ShadiLive preferences' 
    });
  }
};

exports.updateShadiLivePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    const updated = await User.updateShadiLivePreferences(userId, preferences);

    if (!updated) {
      return res.status(400).json({ 
        success: false,
        message: 'Failed to update ShadiLive preferences' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'ShadiLive preferences updated successfully'
    });
  } catch (error) {
    console.error('Update ShadiLive preferences error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating ShadiLive preferences' 
    });
  }
};

exports.newMatches = async (req, res) => {
  try {
    const { looking_for, ...filters } = req.query;
 
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
 
    const users = await User.getNewMatchesByLookingFor(looking_for, processedFilters);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.newMatchesNearMe = async (req, res) => {
  try {
    const { looking_for, nearMe, ...filters } = req.query;

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


    const users = await User.getNewMatchesByNearMe(looking_for, nearMe, processedFilters);
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching new matches by looking_for:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getProfileStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await User.getProfileStatus(userId);
    
    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Get profile status error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error getting profile status' 
    });
  }
};

exports.hideProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.body;

    if (!['active', 'hidden'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status' 
      });
    }

    await User.hideProfile(userId, status);

    res.status(200).json({
      success: true,
      message: `Profile has been ${status === 'hidden' ? 'hidden' : 'unhidden'}`
    });
  } catch (error) {
    console.error('Hide profile error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error updating profile status' 
    });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false,
        message: 'Password is required' 
      });
    }

    await User.deleteProfile(userId, password);

    res.status(200).json({
      success: true,
      message: 'Profile has been deleted. You can recover it within 30 days.'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error deleting profile' 
    });
  }
};

// Matches Controller
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
 