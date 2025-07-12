const pool = require('../config/db');

class User {
  static async create(userData) {
    const { firstName, lastName, email, phone, password, religion, qualification, livingIn, birthDay, birthMonth, birthYear } = userData;
    
    // Construct proper MySQL DATE format (YYYY-MM-DD)
    const dob = birthYear && birthMonth && birthDay 
        ? `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`
        : null;

    const [result] = await pool.query(
        'INSERT INTO users (first_name, last_name, email, phone, password, dob, religion, education, country, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [firstName, lastName, email, phone, password || "", dob, religion, qualification, livingIn, 1, 1]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
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
}

module.exports = User;