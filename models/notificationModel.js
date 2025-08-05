const pool = require('../config/db'); // Assuming you have a db.js file for database connection

const Notification = {
  async create(data) {
    const {
      sender_user_id,
      sender_profile_id,
      receiver_user_id,
      receiver_profile_id,
      type,
      message
    } = data;
    console.log('Creating notification with data:', data);
    const [result] = await pool.query(
      `INSERT INTO notifications 
      (sender_user_id, sender_profile_id, receiver_user_id, receiver_profile_id, type, message)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [sender_user_id, sender_profile_id, receiver_user_id, receiver_profile_id, type, message]
    );

    return result.insertId;
  },

  async getByUser(user_id) {
    const [rows] = await pool.query(
      `SELECT * FROM notifications 
       WHERE receiver_user_id = ? 
       ORDER BY created_at DESC`,
      [user_id]
    );
    return rows;
  },

  async markAsRead(notificationId) {
    const [result] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`,
      [notificationId]
    );
    return result;
  },

    async markAllAsRead(userId) {
    const [result] = await pool.query(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
        [userId]
    );
  return result;
},
// Get notifications where the user is the **receiver**
async getAllReceiverDetails(receiverUserId) {
  const [rows] = await pool.query(
    `
    SELECT 
      n.*,

      -- Sender User Limited Info
      su.first_name AS sender_first_name,
      su.last_name AS sender_last_name,
      su.email AS sender_email,
      su.religion AS sender_religion,
      su.looking_for AS sender_looking_for,

      -- Sender Profile Full Info
      sp.id AS sender_profile_id,
      sp.user_id AS sender_profile_user_id,
      sp.gender AS sender_gender,
      sp.height AS sender_height,
      sp.community AS community,
      sp.city AS sender_city,
      sp.living_in AS sender_living_in,
      sp.qualification AS sender_qualification,
      sp.profession AS sender_profession,
      sp.income AS sender_income,
      sp.profile_image AS sender_profile_image,
      sp.birth_day AS sender_birth_day,
      sp.birth_month AS sender_birth_month,
      sp.birth_year AS sender_birth_year,
      sp.created_at AS sender_profile_created_at,
      sp.updated_at AS sender_profile_updated_at,

      -- Receiver User Limited Info
      ru.first_name AS receiver_first_name,
      ru.last_name AS receiver_last_name,
      ru.email AS receiver_email,
      ru.looking_for AS receiver_looking_for

      

    FROM notifications n
    LEFT JOIN users su ON n.sender_user_id = su.id
    LEFT JOIN profiles sp ON sp.user_id = su.id

    LEFT JOIN users ru ON n.receiver_user_id = ru.id
    LEFT JOIN profiles rp ON rp.user_id = ru.id

    WHERE n.receiver_user_id = ?
         AND n.status = 'pending'
    ORDER BY n.created_at DESC
    `,
    [receiverUserId]
  );
  return rows;
}


,

// Get notifications where the user is the **sender**
async getAllSenderDetails(user_id) {
  const [rows] = await pool.query(
    `SELECT 
      n.id AS notification_id,
      n.type,
      n.message,
      n.is_read,
      n.created_at,
      n.sender_status,
      n.receiver_status,
      n.status,

      su.id AS sender_user_id,
      su.first_name AS sender_first_name,
      su.last_name AS sender_last_name,
      su.email AS sender_email,
      su.phone AS sender_phone,
      su.looking_for AS sender_looking_for,
      su.religion AS sender_religion,

      sp.gender AS sender_gender,
      sp.city AS sender_city,
      sp.profession AS sender_profession,
      sp.profile_image AS sender_profile_image,

      ru.id AS receiver_user_id,
      ru.first_name AS receiver_first_name,
      ru.last_name AS receiver_last_name,
      ru.email AS receiver_email,
      ru.phone AS receiver_phone,
      ru.looking_for AS receiver_looking_for,
      ru.religion AS receiver_religion,

      rp.gender AS receiver_gender,
      rp.city AS receiver_city,
      rp.profession AS receiver_profession,
      rp.profile_image AS receiver_profile_image

    FROM notifications n
    LEFT JOIN users su ON n.sender_user_id = su.id
    LEFT JOIN profiles sp ON n.sender_profile_id = sp.id
    LEFT JOIN users ru ON n.receiver_user_id = ru.id
    LEFT JOIN profiles rp ON n.receiver_profile_id = rp.id
    WHERE n.sender_user_id = ?
    ORDER BY n.created_at DESC`,
    [user_id]
  );
  return rows;
}

};

module.exports = Notification;
