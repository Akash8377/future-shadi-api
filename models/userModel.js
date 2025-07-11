const pool = require('../config/db');

class User {
  static async create(userData) {
    const { firstName, lastName, email, password } = userData;
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, password]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
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
      phone,
      city,
      lives_with_family,
      family_city,
      sub_community,
      marital_status,
      height,
      diet,
      qualification,
      college,
      income,
      work_type,
      profession,
      profile_description,
      exclude_from_affiliates
    } = profileData;

    const [result] = await pool.query(
      `INSERT INTO profiles (
        user_id, person, gender, birth_day, birth_month, birth_year, 
        community, living_in, phone, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college,
        income, work_type, profession, profile_description, exclude_from_affiliates
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, person, gender, birth_day, birth_month, birth_year,
        community, living_in, phone, city, lives_with_family, family_city,
        sub_community, marital_status, height, diet, qualification, college,
        income, work_type, profession, profile_description, exclude_from_affiliates
      ]
    );
    return result.insertId;
  }
}

module.exports = User;