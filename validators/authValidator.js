const { body, validationResult } = require('express-validator');

exports.validateRegister = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('lookingFor').isIn(['Bride', 'Groom']).withMessage('Invalid selection'),
  body('dob').isDate().withMessage('Valid date of birth is required'),
  body('religion').notEmpty().withMessage('Religion is required'),
  body('education').notEmpty().withMessage('Education is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

exports.validateProfileRegister = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('gender').notEmpty().withMessage('Gender is required'),
  body('person').notEmpty().withMessage('Person field is required'),
  body('birthDay').notEmpty().withMessage('Birth day is required'),
  body('birthMonth').notEmpty().withMessage('Birth month is required'),
  body('birthYear').notEmpty().withMessage('Birth year is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
];