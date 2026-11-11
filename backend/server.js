const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const pool = require('./db');
require('dotenv').config();

// Initialize the app FIRST
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// Import Routes
const authRoutes = require('./routes/auth');

// USE Routes (This is where it was failing before)
app.use('/api/auth', authRoutes);

// Auto-create tables
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(100), 
        email VARCHAR(100) UNIQUE, 
        password TEXT, 
        role VARCHAR(20) DEFAULT 'customer'
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, 
        sender_id INTEGER REFERENCES users(id), 
        receiver_id INTEGER REFERENCES users(id), 
        content TEXT, 
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Database tables ready');
  } catch (err) {
    console.error(err);
  }
};
initDB();

// --- ROUTES ---
app.get('/', (req, res) => res.send('Chat API is running 🚀'));

app.get('/api/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
       OR (sender_id = $2 AND receiver_id = $1) 
       ORDER BY created_at ASC`, 
      [user1, user2]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET ALL USERS (For the Admin Sidebar)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('send_message', async (data) => {
    const { senderId, receiverId, content } = data;
    try {
      const result = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
        [senderId, receiverId, content]
      );
      io.emit('receive_message', result.rows[0]); 
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});