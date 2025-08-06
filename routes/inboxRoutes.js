const express = require('express');
const router = express.Router();
const inboxController = require('../controllers/inboxController');

// Route to get notifications where user is the receiver
router.get('/receiver/:user_id', inboxController.getNotificationsForReceiver);

router.get('/preference-receiver/:user_id', inboxController.getPreferenceForReceiver);
// Route to get notifications where user is the sender
router.get('/sender/:user_id', inboxController.getSentRequests);

router.put('/accept/:id', inboxController.acceptNotification);

router.get('/accepted-receiver/:receiverUserId', inboxController.acceptedReceiver);

router.put('/deleted/:id', inboxController.acceptNotification);

router.get('/deleted-receiver/:receiverUserId', inboxController.acceptedReceiver);
module.exports = router;
