// import { formatDateTime } from './datetimeUtils';
// utils/onlineTracker.js

function formatDateTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
const onlineUsers = new Map();           // userId -> socketId
const lastSeenMap = new Map();           // userId -> timestamp
const offlineMessages = new Map();       // userId -> [messages]
const offlineNotifications = new Map();  // userId -> [notifications]
function updateOnlineStatus(userId, isOnline) {
  if (isOnline) {
    lastSeenMap.delete(userId);
  } else {
    lastSeenMap.set(userId, formatDateTime(new Date()));
  }
}
module.exports = {
  onlineUsers,
  lastSeenMap,
  offlineMessages,
  offlineNotifications,
  updateOnlineStatus,
};
