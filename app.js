
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { formatDateTime } = require('./utils/datetimeUtils');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const searchRoutes = require('./routes/searchRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');

dotenv.config();

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

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/inbox', inboxRoutes);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory storage
const onlineUsers = new Map();         // userId -> socketId
const lastSeenMap = new Map();         // userId -> timestamp
const offlineMessages = new Map();     // userId -> [{ from, to, message, time }]



io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);

    // Send any offline messages
    const messages = offlineMessages.get(userId) || [];
    messages.forEach((msg) => {
      io.to(socket.id).emit('receive-message', msg);
    });
    offlineMessages.delete(userId);

    // Notify all users about online status
    io.emit('update-online-users', {
      online: Array.from(onlineUsers.keys()),
      lastSeen: Object.fromEntries(lastSeenMap),
    });
  });

  socket.on('send-message', ({ from, to, message }) => {
    const time = formatDateTime(new Date());
    const msgObj = { from, to, message, sender: from, receiver: to, time };

    const recipientSocketId = onlineUsers.get(to);
    const senderSocketId = socket.id;

    if (recipientSocketId) {
      // Recipient is online
      io.to(recipientSocketId).emit('receive-message', msgObj);
    } else {
      // Recipient offline – store message temporarily
      if (!offlineMessages.has(to)) offlineMessages.set(to, []);
      offlineMessages.get(to).push(msgObj);
    }

    // Emit message back to sender
    io.to(senderSocketId).emit('receive-message', msgObj);
  });

  socket.on('disconnect', () => {
    for (const [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        lastSeenMap.set(userId, formatDateTime(new Date()));
        break;
      }
    }

    io.emit('update-online-users', {
      online: Array.from(onlineUsers.keys()),
      lastSeen: Object.fromEntries(lastSeenMap),
    });

    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Error middleware
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});




// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const dotenv = require('dotenv');
// const authRoutes = require('./routes/authRoutes');
// const profileRoutes = require('./routes/profileRoutes');
// const errorMiddleware = require('./middlewares/errorMiddleware');

// dotenv.config();

// const app = express();

// // Middleware
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

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/profile', profileRoutes);
// // console.log('Profile routes:', profileRoutes); // Should show { router: [Function: router] }

// // Error handling middleware
// app.use(errorMiddleware);

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });