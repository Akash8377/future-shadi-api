const pool = require('../config/db');
const bcrypt = require("bcryptjs");

class User {
static async create(userData) {
  const { firstName, lastName, email, phone, password, religion, qualification, livingIn, birthDay, birthMonth, birthYear } = userData;
  
  // Construct proper MySQL DATE format (YYYY-MM-DD)
  const dob = birthYear && birthMonth && birthDay 
      ? `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`
      : null;

  // Ensure password is hashed if provided, or empty string if not
  const passwordToStore = password || "";

  const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, phone, password, dob, religion, education, country, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, phone, passwordToStore, dob, religion, qualification, livingIn, 1, 1]
  );
  return result.insertId;
}

  static async findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT users.id AS user_id, profiles.id AS profile_id, users.*, profiles.* FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.email = ?',
    [email]
  );
  return rows[0];
}

static async recoverAccount(email) {
  const [result] = await pool.query(
    'UPDATE users SET status = "active", deleted_at = NULL WHERE email = ? AND status = "deleted" AND deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
    [email]
  );
  return result.affectedRows > 0;
}

  static async findById(id) {
    const [rows] = await pool.query('SELECT users.id AS user_id,profiles.id AS profile_id,users.*, profiles.* FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.id = ?', [id]);
    return rows[0];
  }

  static async createProfile(profileData) {
    const {
      user_id,
      person,
      gender,
      birth_day,
      birth_month,
      birth_year,
      community,
      living_in,
      city,
      lives_with_family,
      family_city,
      sub_community,
      marital_status,
      height,
      diet,
      qualification,
      college,
      incomePer,
      income,
      work_type,
      profession,
      profile_description,
      exclude_from_affiliates,
      mother_tongue
    } = profileData;

    const [result] = await pool.query(
      `INSERT INTO profiles (
        user_id, person, gender, birth_day, birth_month, birth_year, 
        community, living_in, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college, incomePer,
        income, work_type, profession, profile_description, exclude_from_affiliates, mother_tongue
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, person, gender, birth_day, birth_month, birth_year,
        community, living_in, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college, incomePer,
        income, work_type, profession, profile_description, exclude_from_affiliates, mother_tongue
      ]
    );
    return result.insertId;
  }

  static async updateProfileImage(userId, imagePath) {
    try {
      // First check if user exists
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update profile image in profiles table
      const [result] = await pool.query(
        'UPDATE profiles SET profile_image = ? WHERE user_id = ?',
        [imagePath, userId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating profile image:', error);
      throw error;
    }
  }

  static async getProfile(userId) {
    try {
      const [profile] = await pool.query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.email, u.dob, u.religion, u.education, u.country,
          p.*
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = ?
      `, [userId]);

      return profile[0] || null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  static async deleteProfileImage(userId) {
    try {
      // Get current image path
      const [result] = await pool.query(
        'SELECT profile_image FROM profiles WHERE user_id = ?',
        [userId]
      );

      if (!result[0] || !result[0].profile_image) {
        return null;
      }

      const imagePath = result[0].profile_image;

      // Remove image reference from database
      await pool.query(
        'UPDATE profiles SET profile_image = NULL WHERE user_id = ?',
        [userId]
      );

      return imagePath;
    } catch (error) {
      console.error('Error deleting profile image:', error);
      throw error;
    }
  }

  static async findByPhone(phone) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE phone = ?',
    [phone]
  );
  return rows[0];
}

static async markEmailAsVerified(email) {
  await pool.query(
    'UPDATE users SET email_verified = 1 WHERE email = ?',
    [email]
  );
}

static async markPhoneAsVerified(phone) {
  await pool.query(
    'UPDATE users SET phone_verified = 1 WHERE phone = ?',
    [phone]
  );
}

static async updateVerification(userId, verificationData) {
  const {
    panVerified,
    panNumber,
    panDetails,
    aadhaarVerified,
    aadhaarNumber,
    aadhaarDetails,
    dlVerified,
    dlNumber,
    dlDetails
  } = verificationData;

  // Update user verification status
  await pool.query(
    `UPDATE profiles SET 
      pan_verified = COALESCE(?, pan_verified),
      pan_number = COALESCE(?, pan_number),
      pan_details = COALESCE(?, pan_details),
      aadhaar_verified = COALESCE(?, aadhaar_verified),
      aadhaar_number = COALESCE(?, aadhaar_number),
      aadhaar_details = COALESCE(?, aadhaar_details),
      dl_verified = COALESCE(?, dl_verified),
      dl_number = COALESCE(?, dl_number),
      dl_details = COALESCE(?, dl_details),
      verified = CASE WHEN (pan_verified OR ?) AND (aadhaar_verified OR ?) AND (dl_verified OR ?) THEN 1 ELSE 0 END
     WHERE user_id = ?`,
    [
      panVerified, panNumber, JSON.stringify(panDetails),
      aadhaarVerified, aadhaarNumber, JSON.stringify(aadhaarDetails),
      dlVerified, dlNumber, JSON.stringify(dlDetails),
      panVerified, aadhaarVerified, dlVerified,
      userId
    ]
  );
}

static async getVerificationStatus(userId) {
  const [rows] = await pool.query(
    `SELECT 
      pan_verified, aadhaar_verified, dl_verified, verified,
      pan_number, aadhaar_number, dl_number
     FROM profiles WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}
static async updatePasswordByEmail(email, password) {
  const [result] = await pool.query(
    'UPDATE users SET password = ? WHERE email = ?',
    [password, email]
  );
  return result.affectedRows > 0;
}

static async updatePasswordById(userId, password) {
  const [result] = await pool.query(
    'UPDATE users SET password = ? WHERE id = ?',
    [password, userId]
  );
  return result.affectedRows > 0;
}

static async generateRandomPassword() {
  const crypto = require('crypto');
  return crypto.randomBytes(4).toString('hex'); // 8 character password
}

static async updatePartnerPreference(userId, partnerPreference, verificationData, hobbies, financialStatus, familyDetails) {
  try {
    // Update partner preference JSON in profiles table
    const [result] = await pool.query(
      'UPDATE profiles SET verificationData=?, hobbies=?, financial_status=?, family_details =?, partner_preference = ? WHERE user_id = ?',
      [JSON.stringify(verificationData), JSON.stringify(hobbies), financialStatus, JSON.stringify(familyDetails), JSON.stringify(partnerPreference), userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating partner preference:', error);
    throw error;
  }
}

static async updateOnlyPartnerPreference(userId, partnerPreference) {
  try {
    // Update partner preference JSON in profiles table
    const [result] = await pool.query(
      'UPDATE profiles SET partner_preference = ? WHERE user_id = ?',
      [JSON.stringify(partnerPreference), userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating partner preference:', error);
    throw error;
  }
}

static async getPartnerPreference(userId) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        partner_preference,
        hobbies,
        financial_status,
        family_details
      FROM profiles 
      WHERE user_id = ?
    `, [userId]);

    if (!rows[0]) {
      return null;
    }

    const preference = rows[0];
    
    // Parse JSON fields if they exist
    if (preference.partner_preference) {
      preference.partner_preference = JSON.parse(preference.partner_preference);
    }
    if (preference.hobbies) {
      preference.hobbies = JSON.parse(preference.hobbies);
    }
    if (preference.financial_status) {
      preference.financial_status = preference.financial_status;
    }
    if (preference.family_details) {
      preference.family_details = JSON.parse(preference.family_details);
    }

    return preference;
  } catch (error) {
    console.error('Error fetching partner preference:', error);
    throw error;
  }
}

static async updatePasswordByEmail(email, hashedPassword) {
  await pool.query(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, email])
}

static async updateBasicInfo(userId, { firstName, lastName, phone }) {
  const updates = [];
  const params = [];
  
  if (firstName) {
    updates.push('first_name = ?');
    params.push(firstName);
  }
  
  if (lastName) {
    updates.push('last_name = ?');
    params.push(lastName);
  }
  
  if (phone) {
    updates.push('phone = ?');
    params.push(phone);
  }
  
  if (updates.length === 0) {
    return false;
  }
  
  params.push(userId);
  
  const [result] = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
  
  return result.affectedRows > 0;
}

static async updateProfile(userId, profileData) {
  try {
    if (Object.keys(profileData).length === 0) {
      return false;
    }
    
    const setClause = Object.keys(profileData)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.values(profileData);
    values.push(userId);
    
    const [result] = await pool.query(
      `UPDATE profiles SET ${setClause} WHERE user_id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}
  static async getUsersByLookingFor(lookingFor) {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
    `, [lookingFor]);
 
    return rows;
  } catch (error) {
    console.error('Error fetching users by looking_for:', error);
    throw error;
  }
}

static async getNewMatchesByLookingFor(lookingFor, filters = {}) {
  try {
    let baseQuery = `
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
    `;
 
    const queryParams = [lookingFor];
    const conditions = [];
 
    // Process each filter
    for (const [key, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;
 
      switch(key) {
        case 'verificationStatus':
          if (values.includes('verified')) {
            conditions.push(`p.verified = 1`);
          }
          break;
         
        case 'photoSettings':
          if (values.includes('public')) {
            conditions.push(`p.photo_privacy = 'public'`);
          }
          if (values.includes('protected')) {
            conditions.push(`p.photo_privacy = 'protected'`);
          }
          break;
         
        case 'recentlyJoined':
          // Only one value for radio buttons
          const days = parseInt(values[0]);
          if (!isNaN(days)) {
            conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
            queryParams.push(days);
          }
          break;
         
        case 'maritalStatus':
          conditions.push(`p.marital_status IN (?)`);
          queryParams.push(values);
          break;
         
        case 'religion':
          conditions.push(`u.religion IN (?)`);
          queryParams.push(values);
          break;
         
        case 'diet':
          conditions.push(`p.diet IN (?)`);
          queryParams.push(values);
          break;
         
        case 'country':
          conditions.push(`p.living_in IN (?)`);
          queryParams.push(values);
          break;
         
        case 'income':
          const incomeConditions = [];
 
          for (const range of values) {
            switch (range) {
              case '0-1':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                break;
              case '1-5':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                break;
              case '5-10':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                break;
              case '10-20':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                break;
              case '20+':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                break;
            }
          }
 
          if (incomeConditions.length > 0) {
            conditions.push(`(${incomeConditions.join(' OR ')})`);
          }
          break;
 
      }
    }
 
    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
 
    const [rows] = await pool.query(baseQuery, queryParams);
    return rows;
  } catch (error) {
    console.error('Error fetching new matches:', error);
    throw error;
  }
}
static async getNewMatchesByNearMe(lookingFor, nearMe, filters = {}) {
  try {
    let baseQuery = `
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ? AND p.city = ?
    `;

    const queryParams = [lookingFor, nearMe];
    const conditions = [];
 
    // Process each filter
    for (const [key, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;
 
      switch(key) {
        case 'verificationStatus':
          if (values.includes('verified')) {
            conditions.push(`p.verified = 1`);
          }
          break;
         
        case 'photoSettings':
          if (values.includes('public')) {
            conditions.push(`p.photo_privacy = 'public'`);
          }
          if (values.includes('protected')) {
            conditions.push(`p.photo_privacy = 'protected'`);
          }
          break;
         
        case 'recentlyJoined':
          // Only one value for radio buttons
          const days = parseInt(values[0]);
          if (!isNaN(days)) {
            conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
            queryParams.push(days);
          }
          break;
         
        case 'maritalStatus':
          conditions.push(`p.marital_status IN (?)`);
          queryParams.push(values);
          break;
         
        case 'religion':
          conditions.push(`u.religion IN (?)`);
          queryParams.push(values);
          break;
         
        case 'diet':
          conditions.push(`p.diet IN (?)`);
          queryParams.push(values);
          break;
         
        case 'country':
          conditions.push(`p.living_in IN (?)`);
          queryParams.push(values);
          break;
         
        case 'income':
          const incomeConditions = [];
 
          for (const range of values) {
            switch (range) {
              case '0-1':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                break;
              case '1-5':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                break;
              case '5-10':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                break;
              case '10-20':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                break;
              case '20+':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                break;
            }
          }
 
          if (incomeConditions.length > 0) {
            conditions.push(`(${incomeConditions.join(' OR ')})`);
          }
          break;
 
      }
    }
 
    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
 
    const [rows] = await pool.query(baseQuery, queryParams);
    return rows;
  } catch (error) {
    console.error('Error fetching new matches:', error);
    throw error;
  }
}
 
static async updateEmail(userId, newEmail) {
  try {
    // First check if the new email already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [newEmail, userId]
    );
    
    if (existing.length > 0) {
      throw new Error('Email already in use by another account');
    }

    // Update the email
    const [result] = await pool.query(
      'UPDATE users SET email = ?, email_verified = 0 WHERE id = ?',
      [newEmail, userId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating email:', error);
    throw error;
  }
}

static async getProfileSettings(userId) {
  try {
    const [rows] = await pool.query(`
      SELECT * 
      FROM profile_settings 
      WHERE user_id = ?
    `, [userId]);
    
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting contact settings:', error);
    throw error;
  }
}

static async updateProfileSettings(userId, { phone, contactStatus, astro_display_status }) {
  try {
    // Start transaction
    await pool.query('START TRANSACTION');

    // Update phone in users table if provided
    if (phone) {
      await pool.query(
        'UPDATE users SET phone = ? WHERE id = ?',
        [phone, userId]
      );
    }

    // Check if settings exist
    const [existing] = await pool.query(
      'SELECT id FROM profile_settings WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing settings
      let updateQuery = 'UPDATE profile_settings SET ';
      const updateParams = [];
      let updates = [];
      
      if (contactStatus) {
        updates.push('display_contact_status = ?');
        updateParams.push(contactStatus);
      }
      
      if (astro_display_status) {
        updates.push('astro_display_status = ?');
        updateParams.push(astro_display_status);
      }
      
      updateQuery += updates.join(', ') + ' WHERE user_id = ?';
      updateParams.push(userId);
      
      await pool.query(updateQuery, updateParams);
    } else {
      // Create new settings with provided values (defaulting others to NULL)
      await pool.query(
        'INSERT INTO profile_settings (user_id, display_contact_status, astro_display_status) VALUES (?, ?, ?)',
        [userId, contactStatus || null, astro_display_status || null]
      );
    }

    // Commit transaction
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error updating profile settings:', error);
    throw error;
  }
}

static async updateAstroDetails(userId, { 
  birth_time,
  birth_city,
  manglik,
  nakshatra,
  rashi
}) {
  try {
    // Start transaction
    await pool.query('START TRANSACTION');

    // Update astro details in profiles table
    const [result] = await pool.query(
      `UPDATE profiles 
       SET birth_time = ?, birth_city = ?, manglik = ?, nakshatra = ?, rashi = ?
       WHERE user_id = ?`,
      [birth_time, birth_city, manglik, nakshatra, rashi, userId]
    );

    // Commit transaction
    await pool.query('COMMIT');
    return result.affectedRows > 0;
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error updating astro details:', error);
    throw error;
  }
}

static async getAlertSettings(userId) {
  try {
    const [settings] = await pool.query(
      'SELECT alert_settings FROM profile_settings WHERE user_id = ?',
      [userId]
    );
    return settings.length > 0 ? JSON.parse(settings[0].alert_settings) : null;
  } catch (error) {
    console.error('Error getting alert settings:', error);
    throw error;
  }
}

static async updateAlertSettings(userId, settings) {
  try {
    await pool.query('START TRANSACTION');
    
    // Check if settings exist
    const [existing] = await pool.query(
      'SELECT id FROM profile_settings WHERE user_id = ?',
      [userId]
    );

    const settingsJson = JSON.stringify(settings);
    
    if (existing.length > 0) {
      await pool.query(
        'UPDATE profile_settings SET alert_settings = ? WHERE user_id = ?',
        [settingsJson, userId]
      );
    } else {
      await pool.query(
        'INSERT INTO profile_settings (user_id, alert_settings) VALUES (?, ?)',
        [userId, settingsJson]
      );
    }

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating alert settings:', error);
    throw error;
  }
}

static async getPrivacySettings(userId) {
  try {
    const [settings] = await pool.query(
      'SELECT privacy_settings FROM profile_settings WHERE user_id = ?',
      [userId]
    );
    return settings.length > 0 ? JSON.parse(settings[0].privacy_settings) : null;
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    throw error;
  }
}

static async updatePrivacySettings(userId, settings) {
  try {
    await pool.query('START TRANSACTION');
    
    const [existing] = await pool.query(
      'SELECT id FROM profile_settings WHERE user_id = ?',
      [userId]
    );

    const settingsJson = JSON.stringify(settings);
    
    if (existing.length > 0) {
      await pool.query(
        'UPDATE profile_settings SET privacy_settings = ? WHERE user_id = ?',
        [settingsJson, userId]
      );
    } else {
      await pool.query(
        'INSERT INTO profile_settings (user_id, privacy_settings) VALUES (?, ?)',
        [userId, settingsJson]
      );
    }

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating privacy settings:', error);
    throw error;
  }
}

static async getShadiLivePreferences(userId) {
  try {
    const [settings] = await pool.query(
      'SELECT shadilive_preferences FROM profile_settings WHERE user_id = ?',
      [userId]
    );
    return settings.length > 0 ? JSON.parse(settings[0].shadilive_preferences) : null;
  } catch (error) {
    console.error('Error getting ShadiLive preferences:', error);
    throw error;
  }
}

static async updateShadiLivePreferences(userId, preferences) {
  try {
    await pool.query('START TRANSACTION');
    
    const [existing] = await pool.query(
      'SELECT id FROM profile_settings WHERE user_id = ?',
      [userId]
    );

    const preferencesJson = JSON.stringify(preferences);
    
    if (existing.length > 0) {
      await pool.query(
        'UPDATE profile_settings SET shadilive_preferences = ? WHERE user_id = ?',
        [preferencesJson, userId]
      );
    } else {
      await pool.query(
        'INSERT INTO profile_settings (user_id, shadilive_preferences) VALUES (?, ?)',
        [userId, preferencesJson]
      );
    }

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating ShadiLive preferences:', error);
    throw error;
  }
}

static async getProfileStatus(userId) {
  try {
    const [user] = await pool.query(
      'SELECT status FROM users WHERE id = ?',
      [userId]
    );
    return user[0]?.status || 'active';
  } catch (error) {
    console.error('Error getting profile status:', error);
    throw error;
  }
}

static async hideProfile(userId, status) {
  try {
    await pool.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, userId]
    );
    return true;
  } catch (error) {
    console.error('Error hiding profile:', error);
    throw error;
  }
}

static async deleteProfile(userId, password) {
  try {
    await pool.query('START TRANSACTION');
    
    // First verify password (you'll need to implement password verification)
    const [user] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user.length) {
      throw new Error('User not found');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }
    
    // Mark as deleted
    await pool.query(
      'UPDATE users SET status = "deleted", deleted_at = NOW() WHERE id = ?',
      [userId]
    );
    
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting profile:', error);
    throw error;
  }
}

static async getMyMatches(lookingFor, filters = {}, partnerPrefs = null) {
  try {
       if (!partnerPrefs || Object.keys(partnerPrefs).length === 0) {
      return [];
    }
   
    let baseQuery = `
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.looking_for,
        u.dob,
        u.religion,
        u.education,
        u.country,
        p.*
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.looking_for = ?
    `;
 
    const queryParams = [lookingFor];
    const conditions = [];
 
    // UI Filters (AND)
    for (const [key, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;
 
      switch (key) {
        case 'verificationStatus':
          if (values.includes('verified')) conditions.push(`p.verified = 1`);
          break;
 
        case 'photoSettings':
          const photoConds = [];
          if (values.includes('public')) photoConds.push(`p.photo_privacy = 'public'`);
          if (values.includes('protected')) photoConds.push(`p.photo_privacy = 'protected'`);
          if (photoConds.length) conditions.push(`(${photoConds.join(' OR ')})`);
          break;
 
        case 'recentlyJoined':
          const days = parseInt(values[0]);
          if (!isNaN(days)) {
            conditions.push(`p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
            queryParams.push(days);
          }
          break;
 
        case 'maritalStatus':
          conditions.push(`p.marital_status IN (?)`);
          queryParams.push(values);
          break;
 
        case 'religion':
          conditions.push(`u.religion IN (?)`);
          queryParams.push(values);
          break;
 
        case 'diet':
          conditions.push(`p.diet IN (?)`);
          queryParams.push(values);
          break;
 
        case 'country':
          conditions.push(`p.living_in IN (?)`);
          queryParams.push(values);
          break;
 
        case 'income':
          const incomeConditions = [];
          for (const range of values) {
            switch (range) {
              case '0-1':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 0 AND 1`);
                break;
              case '1-5':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 1 AND 5`);
                break;
              case '5-10':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 5 AND 10`);
                break;
              case '10-20':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN 10 AND 20`);
                break;
              case '20+':
                incomeConditions.push(`CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) > 20`);
                break;
            }
          }
          if (incomeConditions.length > 0) {
            conditions.push(`(${incomeConditions.join(' OR ')})`);
          }
          break;
      }
    }
 
    // Partner Preferences (ALL must match)
    const preferenceConditions = [];
    if (partnerPrefs) {
      const basic = partnerPrefs.basic || {};
      const community = partnerPrefs.community || {};
      const education = partnerPrefs.education || {};
      const location = partnerPrefs.location || {};
      const other = partnerPrefs.otherDetails || {};
 
      // Age Range
      if (basic.ageRange) {
        const [minAge, maxAge] = basic.ageRange.split('–').map(a => parseInt(a.trim()));
        if (!isNaN(minAge) && !isNaN(maxAge)) {
          preferenceConditions.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) BETWEEN ${minAge} AND ${maxAge}`);
        }
      }
 
      // Height Range
      if (basic.heightRange) {
        const [minStr, maxStr] = basic.heightRange.replace(/[′″]/g, `'`).split('–').map(s => s.trim());
 
        const toInches = (h) => {
          const [ft, inchPart] = h.split("'");
          const inch = parseInt(inchPart?.replace(/[^\d]/g, '') || '0');
          return parseInt(ft) * 12 + inch;
        };
 
        const min = toInches(minStr);
        const max = toInches(maxStr);
 
        preferenceConditions.push(`
          (
            (CAST(SUBSTRING_INDEX(p.height, 'ft', 1) AS UNSIGNED) * 12 +
             CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(p.height, 'ft ', -1), 'in', 1) AS UNSIGNED))
             BETWEEN ${min} AND ${max}
          )
        `);
      }
 
      if (basic.maritalStatus && basic.maritalStatus !== 'Open to All') {
        preferenceConditions.push(`p.marital_status = ${pool.escape(basic.maritalStatus)}`);
      }
 
      if (community.religion && community.religion !== 'Open to All') {
        preferenceConditions.push(`u.religion = ${pool.escape(community.religion)}`);
      }
 
      if (community.community && community.community !== 'Open to All') {
        preferenceConditions.push(`p.community = ${pool.escape(community.community)}`);
      }
 
      if (community.motherTongue && community.motherTongue !== 'Open to All') {
        preferenceConditions.push(`p.mother_tongue = ${pool.escape(community.motherTongue)}`);
      }
 
     if (education.qualification && education.qualification !== 'Open to All') {
        const eduMap = {
          "High School": ["10th", "12th", "High School", "Secondary School"],
          "Bachelor's Degree": ["B.Tech", "BE", "B.Sc", "BA", "BBA", "B.Com"],
          "Master's Degree": ["MCA", "MBA", "M.Tech", "ME", "MSc", "MA"],
          "PhD": ["PhD", "Doctorate", "DPhil"],
          "Other": ["Diploma", "Associate Degree", "Other"]
        };
 
        const mappedValues = eduMap[education.qualification];
        if (mappedValues) {
          preferenceConditions.push(`u.education IN (${mappedValues.map(val => pool.escape(val)).join(', ')})`);
        } else {
          preferenceConditions.push(`u.education = ${pool.escape(education.qualification)}`);
        }
      }
 
      if (education.workingWith && education.workingWith !== 'Open to All') {
        preferenceConditions.push(`p.working_with = ${pool.escape(education.workingWith)}`);
      }
 
      if (education.profession && education.profession !== 'Open to All') {
        preferenceConditions.push(`p.profession = ${pool.escape(education.profession)}`);
      }
 
      if (education.annualIncome && education.annualIncome !== 'Open to All') {
        const match = education.annualIncome.match(/INR\s*(\d+)\s*lakh.*?(\d+)\s*lakh/i);
        if (match) {
          const min = parseInt(match[1]);
          const max = parseInt(match[2]);
          preferenceConditions.push(`
            CAST(SUBSTRING_INDEX(p.income, ' ', 1) AS UNSIGNED) BETWEEN ${min} AND ${max}
          `);
        }
      }
 
 
      if (location.country && location.country !== 'Open to All') {
        const escapedCountry = pool.escape(location.country);
       preferenceConditions.push(`(p.living_in = ${escapedCountry} OR u.country = ${escapedCountry})`);
    }
 
      if (other.diet && other.diet !== 'Open to All') {
        preferenceConditions.push(`p.diet = ${pool.escape(other.diet)}`);
      }
 
      if (other.profileManagedBy && other.profileManagedBy !== 'Open to All') {
        preferenceConditions.push(`p.profile_managed_by = ${pool.escape(other.profileManagedBy)}`);
      }
    }
 
    // Merge WHERE conditions
    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
 
    if (preferenceConditions.length > 0) {
      baseQuery += ' AND ' + preferenceConditions.join(' AND ');
    }
 
    const [rows] = await pool.query(baseQuery, queryParams);
    return rows;
  } catch (error) {
    console.error('Error fetching new matches:', error);
    throw error;
  }
}

}



module.exports = User;