const Inbox = require('../models/inboxModel');

exports.getNotificationsForReceiver = async (req, res) => {
  try {
    const userId = req.params.user_id;
    const receivers = await Inbox.getAllReceiverDetails(userId);

    res.status(200).json({ success: true, receivers });
  } catch (error) {
    console.error('Error fetching receiver notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSentRequests = async (req, res) => {
  try {
    const userId = req.params.user_id;
    const sentRequests = await Inbox.getAllSenderRequests(userId);

    res.status(200).json({ success: true, sentRequests });
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.acceptNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await Inbox.acceptNofication(notificationId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found or already accepted.' });
    }

    res.status(200).json({ success: true, message: 'Notification accepted successfully' });
  } catch (error) {
    console.error('Accept Notification Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

  exports.acceptedReceiver = async (req, res)  =>{
    const receiverUserId = req.params.receiverUserId;

    try {
      const results = await Inbox.acceptedReceiver(receiverUserId);
      res.status(200).json(results);
    } catch (error) {
      console.error('Error fetching accepted receiver data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  exports.deleteNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await Inbox.deleteNofication(notificationId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found or already deleted.' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

  exports.deletedReceiver = async (req, res)  =>{
    const receiverUserId = req.params.receiverUserId;

    try {
      const results = await Inbox.deletedReceiver(receiverUserId);
      res.status(200).json(results);
    } catch (error) {
      console.error('Error fetching deleted receiver data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
