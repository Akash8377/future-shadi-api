// utils/onlineTracker.js

const onlineUsers = new Map();           // userId -> socketId
const lastSeenMap = new Map();           // userId -> timestamp
const offlineMessages = new Map();       // userId -> [messages]
const offlineNotifications = new Map();  // userId -> [notifications]

module.exports = {
  onlineUsers,
  lastSeenMap,
  offlineMessages,
  offlineNotifications,
};
