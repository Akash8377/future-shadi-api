

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { formatDateTime } = require('./utils/datetimeUtils');
const {
  onlineUsers,
  lastSeenMap,
  offlineMessages,
  offlineNotifications,
} = require('./utils/onlineTracker');

// Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const matchesRoutes = require('./routes/matchesRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const searchRoutes = require('./routes/searchRoutes');
const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes, galleryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/search', searchRoutes);

// API: Snapshot of online users
app.get('/api/online-status', (req, res) => {
  res.json({
    online: Array.from(onlineUsers.keys()),
    lastSeen: Object.fromEntries(lastSeenMap),
  });
});

// Socket.IO Setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// Socket.IO Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: token missing'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = payload.id || payload._id;
    return next();
  } catch (err) {
    return next(new Error('Authentication error: invalid token'));
  }
});

// Emit single user updates
function emitUserOnline(userId) {
  io.emit('user-online', { userId });
}
function emitUserOffline(userId, lastSeen) {
  io.emit('user-offline', { userId, lastSeen });
}

// Debounced broadcast (optional full update)
let debounceTimer;
function scheduleBroadcastOnlineStatus() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    io.emit('update-online-users', {
      online: Array.from(onlineUsers.keys()),
      lastSeen: Object.fromEntries(lastSeenMap),
    });
  }, 500);
}

// Socket.IO Events
io.on('connection', (socket) => {
  const userId = String(socket.data.userId);
  console.log(`🔌 Socket connected: ${socket.id} for user ${userId}`);

  // Handle multi-tab login
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
  onlineUsers.get(userId).push(socket.id);

  // Emit user online
  emitUserOnline(userId);

  // Send offline messages
  const messages = offlineMessages.get(userId) || [];
  messages.forEach((msg) => {
    io.to(socket.id).emit('receive-message', msg);
  });
  offlineMessages.delete(userId);

  // Send offline notifications
  const notifs = offlineNotifications.get(userId) || [];
  notifs.forEach((notif) => {
    io.to(socket.id).emit('new_notification', notif);
  });
  offlineNotifications.delete(userId);

  // Message event with validation
  socket.on('send-message', ({ from, to, message }) => {
    if (
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      typeof message !== 'string'
    ) {
      return socket.emit('error', 'Invalid message payload');
    }

    const time = formatDateTime(new Date());
    const msgObj = { from, to, message, sender: from, receiver: to, time };
    const recipientSocketIds = onlineUsers.get(to) || [];

    if (recipientSocketIds.length > 0) {
      recipientSocketIds.forEach((id) => {
        io.to(id).emit('receive-message', msgObj);
      });
    } else {
      if (!offlineMessages.has(to)) offlineMessages.set(to, []);
      offlineMessages.get(to).push(msgObj);
    }

    io.to(socket.id).emit('receive-message', msgObj);
  });

  // Manual logout from client
  socket.on('userOffline', ({ userId }) => {
    if (!userId) return;
    const sockets = onlineUsers.get(userId) || [];
    onlineUsers.set(userId, sockets.filter((id) => id !== socket.id));
    if (onlineUsers.get(userId).length === 0) {
      onlineUsers.delete(userId);
      lastSeenMap.set(userId, formatDateTime(new Date()));
      emitUserOffline(userId, lastSeenMap.get(userId));
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId) || [];
    const filtered = sockets.filter((id) => id !== socket.id);

    if (filtered.length > 0) {
      onlineUsers.set(userId, filtered);
    } else {
      onlineUsers.delete(userId);
      lastSeenMap.set(userId, formatDateTime(new Date()));
      emitUserOffline(userId, lastSeenMap.get(userId));
    }

    console.log(`❌ Socket disconnected: ${socket.id} for user ${userId}`);
  });
});

// Optional: Periodic cleanup of offline queues
setInterval(() => {
  offlineMessages.forEach((msgs, userId) => {
    if (msgs.length > 50) {
      offlineMessages.set(userId, msgs.slice(-50));
    }
  });

  offlineNotifications.forEach((notifs, userId) => {
    if (notifs.length > 50) {
      offlineNotifications.set(userId, notifs.slice(-50));
    }
  });
}, 5 * 60 * 1000); // every 5 minutes

// Optional: Save lastSeenMap to file on shutdown
function saveLastSeenToFile() {
  fs.writeFileSync(
    './lastSeenBackup.json',
    JSON.stringify(Object.fromEntries(lastSeenMap), null, 2)
  );
}

process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down...');
  saveLastSeenToFile();
  process.exit();
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export for tests or reuse
module.exports = { app, server, io };




// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const dotenv = require('dotenv');
// const http = require('http');
// const { Server } = require('socket.io');
// const { formatDateTime } = require('./utils/datetimeUtils');

// const authRoutes = require('./routes/authRoutes');
// const profileRoutes = require('./routes/profileRoutes');
// const searchRoutes = require('./routes/searchRoutes');
// const inboxRoutes = require('./routes/inboxRoutes');
// const galleryRoutes = require('./routes/galleryRoutes');
// const notificationRoutes = require('./routes/notificationRoutes');
// const errorMiddleware = require('./middlewares/errorMiddleware');

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// // Middlewares
// app.use(cors());
// app.use(helmet());
// app.use(morgan('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', (req, res, next) => {
//   res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
//   next();
// });
// app.use(express.static('public'));

// app.use('/api/auth', authRoutes);
// app.use('/api/profile', profileRoutes, galleryRoutes);
// app.use('/api/search', searchRoutes);
// app.use('/api/inbox', inboxRoutes);
// app.use('/api/notifications', notificationRoutes);

// // Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST'],
//   },
// });

// // In-memory storage
// const onlineUsers = new Map();         // userId -> socketId
// const lastSeenMap = new Map();         // userId -> timestamp
// const offlineMessages = new Map();     // userId -> [{ from, to, message, time }]



// io.on('connection', (socket) => {
//   console.log(`🔌 Socket connected: ${socket.id}`);

//   socket.on('user-online', (userId) => {
//     onlineUsers.set(userId, socket.id);

//     // Send any offline messages
//     const messages = offlineMessages.get(userId) || [];
//     messages.forEach((msg) => {
//       io.to(socket.id).emit('receive-message', msg);
//     });
//     offlineMessages.delete(userId);

//     // Notify all users about online status
//     io.emit('update-online-users', {
//       online: Array.from(onlineUsers.keys()),
//       lastSeen: Object.fromEntries(lastSeenMap),
//     });
//   });

//   socket.on('send-message', ({ from, to, message }) => {
//     const time = formatDateTime(new Date());
//     const msgObj = { from, to, message, sender: from, receiver: to, time };

//     const recipientSocketId = onlineUsers.get(to);
//     const senderSocketId = socket.id;

//     if (recipientSocketId) {
//       // Recipient is online
//       io.to(recipientSocketId).emit('receive-message', msgObj);
//     } else {
//       // Recipient offline – store message temporarily
//       if (!offlineMessages.has(to)) offlineMessages.set(to, []);
//       offlineMessages.get(to).push(msgObj);
//     }

//     // Emit message back to sender
//     io.to(senderSocketId).emit('receive-message', msgObj);
//   });

//   socket.on('disconnect', () => {
//     for (const [userId, id] of onlineUsers.entries()) {
//       if (id === socket.id) {
//         onlineUsers.delete(userId);
//         lastSeenMap.set(userId, formatDateTime(new Date()));
//         break;
//       }
//     }

//     io.emit('update-online-users', {
//       online: Array.from(onlineUsers.keys()),
//       lastSeen: Object.fromEntries(lastSeenMap),
//     });

//     console.log(`❌ Socket disconnected: ${socket.id}`);
//   });
// });

// // Error middleware
// app.use(errorMiddleware);

// // Start server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });