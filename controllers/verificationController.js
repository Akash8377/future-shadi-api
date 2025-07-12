const KarzaService = require('../services/karzaService');
const User = require('../models/userModel');
const { validationResult } = require('express-validator');

exports.verifyPAN = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { panNumber } = req.body;
    const userId = req.user.id; // From auth middleware

    // Verify PAN with Karza
    const result = await KarzaService.verifyPAN(panNumber);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PAN number'
      });
    }

    // Save verification to database
    await User.updateVerification(userId, {
      panVerified: true,
      panNumber: panNumber,
      panDetails: result.data
    });

    res.status(200).json({
      success: true,
      message: 'PAN verified successfully',
      data: result.data
    });
  } catch (error) {
    console.error('PAN verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify PAN'
    });
  }
};

exports.verifyAadhaar = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { aadhaarNumber } = req.body;
    const userId = req.user.id;

    // Verify Aadhaar with Karza
    const result = await KarzaService.verifyAadhaar(aadhaarNumber);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Aadhaar number'
      });
    }

    // Save verification to database
    await User.updateVerification(userId, {
      aadhaarVerified: true,
      aadhaarNumber: aadhaarNumber,
      aadhaarDetails: result.data
    });

    res.status(200).json({
      success: true,
      message: 'Aadhaar verified successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Aadhaar verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify Aadhaar'
    });
  }
};

exports.verifyDrivingLicense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dlNumber } = req.body;
    const userId = req.user.id;

    // Verify DL with Karza
    const result = await KarzaService.verifyDrivingLicense(dlNumber);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Driving License number'
      });
    }

    // Save verification to database
    await User.updateVerification(userId, {
      dlVerified: true,
      dlNumber: dlNumber,
      dlDetails: result.data
    });

    res.status(200).json({
      success: true,
      message: 'Driving License verified successfully',
      data: result.data
    });
  } catch (error) {
    console.error('DL verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify Driving License'
    });
  }
};