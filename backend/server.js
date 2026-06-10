require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const cookieParser = require("cookie-parser")
const { execSync } = require("child_process")

connectDB();

try {
    const chromePath = execSync("find /opt/render/.cache/puppeteer -name 'chrome' -type f 2>/dev/null").toString().trim()
    console.log("=== CHROME PATH ===", chromePath)
} catch (e) {
    console.log("=== CHROME NOT FOUND ===", e.message)
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://interview-web-i92x.vercel.app",
        "https://interview-web-eight.vercel.app",
        /\.vercel\.app$/
    ],
    credentials: true
}))
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/interview', require('./routes/interviewroute'));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Node.js backend!' })
});

// Temporary: list available Gemini models
app.get('/api/models', async (req, res) => {
    try {
        const { GoogleGenAI } = require("@google/genai")
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
        const result = await ai.models.list()
        const models = []
        for await (const model of result) {
            models.push(model.name)
        }
        res.json(models)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
});