
const Notification = require('../models/notificationModel');

exports.createNotification = async (req, res) => {
  try {
    const notificationData = req.body;
    const insertId = await Notification.create(notificationData);
    console.log('Notification created with ID:', insertId);
    console.log('Notification data:', notificationData);
    // Emit notification via Socket.IO (if socket is integrated)
    if (req.app.get('io')) {
      const io = req.app.get('io');
        io.to(`user_${notificationData.receiver_user_id}`).emit('new_notification', {
        id: insertId,
        sender_user_id: notificationData.sender_user_id,
        sender_profile_id: notificationData.sender_profile_id,
        receiver_user_id: notificationData.receiver_user_id,
        type: notificationData.type,
        message: notificationData.message,
        is_read: 0, // Ensure this is included
        created_at: new Date() // Important for sorting
        });
    }

    res.status(201).json({ success: true, insertId });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getNotificationsForUser = async (req, res) => {
  try {
    const userId = req.params.user_id;
    const notifications = await Notification.getByUser(userId);
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    await Notification.markAsRead(notificationId);
    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.params.userId;

    await Notification.markAllAsRead(userId);

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


