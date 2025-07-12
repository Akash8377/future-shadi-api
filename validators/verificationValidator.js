const { body } = require('express-validator');

exports.validatePAN = [
  body('panNumber')
    .notEmpty().withMessage('PAN number is required')
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN number format')
];

exports.validateAadhaar = [
  body('aadhaarNumber')
    .notEmpty().withMessage('Aadhaar number is required')
    .isLength({ min: 12, max: 12 }).withMessage('Aadhaar must be 12 digits')
    .isNumeric().withMessage('Aadhaar must contain only numbers')
];

exports.validateDL = [
  body('dlNumber')
    .notEmpty().withMessage('Driving License number is required')
    .isLength({ min: 5 }).withMessage('Invalid Driving License number')
];