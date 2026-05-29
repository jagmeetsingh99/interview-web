require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const cookieParser = require("cookie-parser")

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Update this if your frontend runs on a different port
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/interview',require('./routes/interviewroute'));



// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Node.js backend!' });
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
