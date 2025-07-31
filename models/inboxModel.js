// models/inboxModel.js
const pool = require('../config/db'); // Adjust path as needed

const InboxModel = {
  // Get notifications where the user is the receiver
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
  },

  // Get notifications where the user is the sender
 async getAllSenderRequests(senderUserId) {
  const [rows] = await pool.query(
    `
    SELECT 
      n.*,

      -- Receiver User Info
      ru.first_name AS receiver_first_name,
      ru.last_name AS receiver_last_name,
      ru.email AS receiver_email,
      ru.religion AS receiver_religion,
      ru.looking_for AS receiver_looking_for,

      -- Receiver Profile Info
      rp.id AS receiver_profile_id,
      rp.user_id AS receiver_profile_user_id,
      rp.gender AS receiver_gender,
      rp.height AS receiver_height,
      rp.community AS receiver_community,
      rp.city AS receiver_city,
      rp.living_in AS receiver_living_in,
      rp.qualification AS receiver_qualification,
      rp.profession AS receiver_profession,
      rp.income AS receiver_income,
      rp.profile_image AS receiver_profile_image,
      rp.birth_day AS receiver_birth_day,
      rp.birth_month AS receiver_birth_month,
      rp.birth_year AS receiver_birth_year,
      rp.created_at AS receiver_profile_created_at,
      rp.updated_at AS receiver_profile_updated_at,

      -- Sender User Info
      su.first_name AS sender_first_name,
      su.last_name AS sender_last_name,
      su.email AS sender_email

    FROM notifications n
    LEFT JOIN users ru ON n.receiver_user_id = ru.id
    LEFT JOIN profiles rp ON rp.user_id = ru.id
    LEFT JOIN users su ON n.sender_user_id = su.id
    LEFT JOIN profiles sp ON sp.user_id = su.id

    WHERE n.sender_user_id = ?
      AND n.status = 'pending'
    ORDER BY n.created_at DESC
    `,
    [senderUserId]
  );
  return rows;
},

  async acceptNofication(notificationId){
    const [result] = await pool.query(
        `UPDATE notifications SET status = 'accepted' WHERE id =?`,
        [notificationId]
    )
    return result;
  }, 

  async acceptedReceiver(receiverUserId) {
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
        AND n.status = 'accepted'
      GROUP BY n.sender_user_id
      ORDER BY n.created_at DESC
      `,
      [receiverUserId]
    );
    return rows;
  },
  
  async deleteNofication(notificationId){
    const [result] = await pool.query(
        `UPDATE notifications SET status = 'deleted' WHERE id =?`,
        [notificationId]
    )
    return result;
  }, 
  
  async deletedReceiver(receiverUserId) {
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
        AND n.status = 'deleted'
      GROUP BY n.sender_user_id
      ORDER BY n.created_at DESC
      `,
      [receiverUserId]
    );
    return rows;
  },
};

module.exports = InboxModel;
