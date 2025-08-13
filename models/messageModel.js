// models/messageModel.js
const db = require('../config/db'); // adjust path to your DB connection

// Get message history between two users
const getMessageHistory = (user1, user2) => {
    return db.query(
        `
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?)
        OR (sender_id = ? AND receiver_id = ?)
        ORDER BY sent_at ASC
        `,
        [user1, user2, user2, user1]
    );
};

// Insert a new message
const insertMessage = (sender_id, receiver_id, content) => {
    return db.query(
        `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
        [sender_id, receiver_id, content]
    );
};

// Get a message by ID
const getMessageById = (id) => {
    return db.query(
        `SELECT * FROM messages WHERE id = ?`,
        [id]
    );
};

module.exports = {
    getMessageHistory,
    insertMessage,
    getMessageById
};
