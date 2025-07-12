const pool = require("../config/db");

class OtpModel {
  static async createOTP(otpData) {
    const { contact, otp, type, expiresAt } = otpData;
    
    // Delete any existing OTPs for this contact
    await pool.query(
      "DELETE FROM otps WHERE contact = ? AND type = ?",
      [contact, type]
    );

    // Insert new OTP
    const [result] = await pool.query(
      "INSERT INTO otps (contact, otp, type, expires_at) VALUES (?, ?, ?, ?)",
      [contact, otp, type, expiresAt]
    );

    return result.insertId;
  }

  static async getValidOTP(contact, type) {
    const [rows] = await pool.query(
      `SELECT * FROM otps 
       WHERE contact = ? AND type = ? AND used = 0 AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [contact, type]
    );

    return rows[0] || null;
  }

  static async markAsUsed(id) {
    await pool.query(
      "UPDATE otps SET used = 1 WHERE id = ?",
      [id]
    );
  }
}

module.exports = OtpModel;