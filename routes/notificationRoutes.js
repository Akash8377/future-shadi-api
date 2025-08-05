const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create new notification
router.post('/send', notificationController.createNotification);

// Get all notifications for a user
router.get('/:user_id', notificationController.getNotificationsForUser);

// Mark notification as read
router.put('/read/:id', notificationController.markAsRead);

// routes/notificationRoutes.js
router.put("/read-all/:userId", notificationController.markAllAsRead);


module.exports = router;
