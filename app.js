require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { formatDateTime } = require("./utils/datetimeUtils");
const {
  onlineUsers,
  lastSeenMap,
  offlineMessages,
  offlineNotifications,
  updateOnlineStatus,
} = require("./utils/onlineTracker");
const User = require("./models/userModel");
const db = require("./config/db");
// Routes Imports
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const inboxRoutes = require("./routes/inboxRoutes");
const matchesRoutes = require("./routes/matchesRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const searchRoutes = require("./routes/searchRoutes");

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(express.static("public"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes, galleryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/search", searchRoutes);

// API: Snapshot of online users
app.get("/api/online-status", (req, res) => {
  res.json({
    online: Array.from(onlineUsers.keys()),
    lastSeen: Object.fromEntries(lastSeenMap),
  });
});

// Get message history with JSON storage
app.get("/api/messages/history", async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      return res.status(400).json({ error: "Missing user IDs" });
    }

    // Create conversation ID (sorted to ensure consistency)
    const id1 = parseInt(user1);
    const id2 = parseInt(user2);
    const minId = Math.min(id1, id2);
    const maxId = Math.max(id1, id2);
    const conversationId = `${minId}-${maxId}`;

    const [result] = await db.query(
      `SELECT messages FROM conversations WHERE conversation_id = ?`,
      [conversationId]
    );

    // Return messages as JSON
    const messages = result.length > 0 ? JSON.parse(result[0].messages) : [];
    res.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send message with JSON storage
app.post("/api/messages/send", async (req, res) => {
  try {
    const { sender_id, receiver_id, content } = req.body;

    if (!sender_id || !receiver_id || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create conversation ID (sorted to ensure consistency)
    const id1 = parseInt(sender_id);
    const id2 = parseInt(receiver_id);
    const minId = Math.min(id1, id2);
    const maxId = Math.max(id1, id2);
    const conversationId = `${minId}-${maxId}`;

    // Create new message object
    const newMessage = {
      id: uuidv4(),
      sender_id: id1,
      receiver_id: id2,
      content: content.trim(),
      sent_at: new Date().toISOString()
    };

    // Check if conversation exists
    const [existing] = await db.query(
      `SELECT messages FROM conversations WHERE conversation_id = ?`,
      [conversationId]
    );

    if (existing.length > 0) {
      // Update existing conversation
      const messages = JSON.parse(existing[0].messages);
      messages.push(newMessage);
      
      await db.query(
        `UPDATE conversations SET messages = ? WHERE conversation_id = ?`,
        [JSON.stringify(messages), conversationId]
      );
    } else {
      // Create new conversation
      await db.query(
        `INSERT INTO conversations (conversation_id, user1_id, user2_id, messages) 
         VALUES (?, ?, ?, ?)`,
        [conversationId, minId, maxId, JSON.stringify([newMessage])]
      );
    }

    // Broadcast the message in real-time
    const io = req.app.get('io');
    
    // Convert IDs to strings for socket rooms
    const receiverRoom = `user_${String(receiver_id)}`;
    const senderRoom = `user_${String(sender_id)}`;
    
    io.to(receiverRoom).emit('receive-message', newMessage);
    io.to(senderRoom).emit('receive-message', newMessage);

    res.json({ message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add this at the top of app.js
const getLastMessage = (messages) => {
  const parsed = JSON.parse(messages);
  return parsed.length > 0 ? parsed[parsed.length - 1] : null;
};

// Modify the existing /api/inbox/chat-users endpoint
app.get("/api/inbox/chat-users", async (req, res) => {
  try {
    const { user_id, looking_for } = req.query;
    const [users] = await db.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.profile_image, 
        u.online, u.birth_year, u.birth_month, u.birth_day,
        u.height, u.religion, u.community, u.mother_tongue,
        u.profession, u.city, u.country,
        c.messages,
        CASE 
          WHEN cr.sender_id = ? AND cr.status = 'pending' THEN true
          ELSE false
        END AS connectionRequest,
        MAX(cr.created_at) AS date
      FROM users u
      LEFT JOIN connection_requests cr 
        ON (cr.receiver_id = u.id OR cr.sender_id = u.id)
      LEFT JOIN conversations c 
        ON (c.user1_id = u.id OR c.user2_id = u.id) 
        AND (c.user1_id = ? OR c.user2_id = ?)
      WHERE u.looking_for = ?
      GROUP BY u.id
    `, [user_id, user_id, user_id, looking_for]);

    const enhancedUsers = users.map(user => {
      const lastMessage = user.messages ? getLastMessage(user.messages) : null;
      return {
        ...user,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          sent_at: lastMessage.sent_at,
          is_sender: lastMessage.sender_id === parseInt(user_id)
        } : null
      };
    });

    res.json({ users: enhancedUsers });
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Socket.IO Setup
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
app.set("io", io);

// Socket.IO Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error: token missing"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = String(payload.id || payload._id); // Ensure ID is string
    return next();
  } catch (err) {
    return next(new Error("Authentication error: invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  console.log(`🔌 Socket connected: ${socket.id} for user ${userId}`);
  
  // Join user's personal room
  socket.join(`user_${userId}`);

    // Update online status
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
  onlineUsers.get(userId).push(socket.id);
  updateOnlineStatus(userId, true);
  
  // Handle joining conversation rooms
  socket.on('join-conversation', ({ conversationId }) => {
    socket.join(`conv_${conversationId}`);
    console.log(`User ${userId} joined conversation ${conversationId}`);
  });
  
  socket.on('leave-conversation', ({ conversationId }) => {
    socket.leave(`conv_${conversationId}`);
    console.log(`User ${userId} left conversation ${conversationId}`);
  });

  // Handle message sending
  socket.on("send-message", async (msg) => {
    try {
      // Validate message
      if (!msg.sender_id || !msg.receiver_id || !msg.content) {
        return socket.emit("error", "Invalid message payload");
      }

      // Generate conversation ID
      const id1 = parseInt(msg.sender_id);
      const id2 = parseInt(msg.receiver_id);
      const conversationId = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
      
      // Create message object
      const newMessage = {
        id: uuidv4(),
        sender_id: id1,
        receiver_id: id2,
        content: msg.content,
        sent_at: new Date().toISOString(),
        is_delivered: false
      };

      // Save to database (JSON format)
      const [existing] = await db.query(
        `SELECT messages FROM conversations WHERE conversation_id = ?`,
        [conversationId]
      );

      if (existing.length > 0) {
        const messages = JSON.parse(existing[0].messages);
        messages.push(newMessage);
        
        await db.query(
          `UPDATE conversations SET messages = ? WHERE conversation_id = ?`,
          [JSON.stringify(messages), conversationId]
        );
      } else {
        await db.query(
          `INSERT INTO conversations (conversation_id, user1_id, user2_id, messages) 
           VALUES (?, ?, ?, ?)`,
          [conversationId, Math.min(id1, id2), Math.max(id1, id2), JSON.stringify([newMessage])]
        );
      }

      // Broadcast to conversation room
      io.to(`conv_${conversationId}`).emit('receive-message', newMessage);
      
      // Also send to individual user rooms for multi-device sync
      io.to(`user_${msg.sender_id}`).emit('receive-message', newMessage);
      io.to(`user_${msg.receiver_id}`).emit('receive-message', newMessage);

    } catch (error) {
      console.error("Error handling message:", error);
      socket.emit("error", "Message processing failed");
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId) || [];
    const filtered = sockets.filter((id) => id !== socket.id);

    if (filtered.length > 0) {
      onlineUsers.set(userId, filtered);
    } else {
      onlineUsers.delete(userId);
      lastSeenMap.set(userId, formatDateTime(new Date()));
    }
    
    console.log(`❌ Socket disconnected: ${socket.id} for user ${userId}`);
  });
});

const createConversationsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id VARCHAR(255) PRIMARY KEY,
        user1_id BIGINT NOT NULL,
        user2_id BIGINT NOT NULL,
        messages JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (user1_id),
        INDEX (user2_id)
      )
    `);
    console.log("✅ Conversations table ready");
  } catch (error) {
    console.error("Error creating conversations table:", error);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await createConversationsTable();
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, server, io };