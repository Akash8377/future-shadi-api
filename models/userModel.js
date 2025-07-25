const pool = require('../config/db');

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
    const [rows] = await pool.query('SELECT users.*, profiles.* FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.email = ?', [email]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT users.*, profiles.* FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.id = ?', [id]);
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
      exclude_from_affiliates
    } = profileData;

    const [result] = await pool.query(
      `INSERT INTO profiles (
        user_id, person, gender, birth_day, birth_month, birth_year, 
        community, living_in, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college, incomePer,
        income, work_type, profession, profile_description, exclude_from_affiliates
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, person, gender, birth_day, birth_month, birth_year,
        community, living_in, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college, incomePer,
        income, work_type, profession, profile_description, exclude_from_affiliates
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
    console.log('Update result:', result);
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
    console.log('Update result:', result);
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

static async updateContactSettings(userId, { phone, contactStatus }) {
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
      await pool.query(
        'UPDATE profile_settings SET display_contact_status = ? WHERE user_id = ?',
        [contactStatus, userId]
      );
    } else {
      // Create new settings
      await pool.query(
        'INSERT INTO profile_settings (user_id, display_contact_status) VALUES (?, ?)',
        [userId, contactStatus]
      );
    }

    // Commit transaction
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error updating contact settings:', error);
    throw error;
  }
}

}



module.exports = User;