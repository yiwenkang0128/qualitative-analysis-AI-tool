const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const port = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key'; 
const ROOT_ADMIN_EMAIL = 'admin@test.com';

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token; 
    
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    next();
};

const requireRootAdmin = (req, res, next) => {
    if (req.user.email !== ROOT_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Forbidden: Root admin privileges required' });
    }
    next();
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// === Auth API ===

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 2 * 60 * 60 * 1000,
        sameSite: 'lax'
    });

    res.json({ role: user.role, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await prisma.user.create({
            data: { email, password: hashedPassword, role: 'user' }
        });
        res.json({ message: 'Registration successful' });
    } catch (e) {
        res.status(400).json({ error: 'Email already registered' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ email: req.user.email, role: req.user.role });
});

// === User API ===

app.get('/api/sessions', authenticateToken, async (req, res) => {
    const sessions = await prisma.document.findMany({
        where: { userId: req.user.id },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
    });
    res.json(sessions);
});

app.get('/api/sessions/:id', authenticateToken, async (req, res) => {
    const doc = await prisma.document.findUnique({
        where: { id: req.params.id },
        include: { chats: { orderBy: { createdAt: 'asc' } } }
    });
    if (!doc || (doc.userId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied' });
    }
    res.json({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        topics: JSON.parse(doc.topicsJson || '[]'),
        chatHistory: doc.chats
    });
});

app.post('/api/upload', authenticateToken, upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const title = req.body.title || req.file.originalname;
    const pdfPath = req.file.path;

    const pythonProcess = spawn('./venv/bin/python', ['analyze.py', pdfPath]);
    let dataString = '';
    let errorString = '';
    
    pythonProcess.stdout.on('data', (data) => dataString += data.toString());
    pythonProcess.stderr.on('data', (data) => errorString += data.toString());

    pythonProcess.on('close', async (code) => {
        if (code !== 0) {
            console.error('❌ Analysis failed (STDERR):', errorString);
            return res.status(500).json({ error: 'Analysis failed' });
        }
        try {
            const result = JSON.parse(dataString);
            const newDoc = await prisma.document.create({
                data: {
                    userId: req.user.id,
                    title: title,
                    originalName: req.file.originalname,
                    serverFilename: result.serverFilename,
                    fullText: result.fullText || "",
                    summary: result.summary,
                    topicsJson: JSON.stringify(result.topics)
                }
            });
            res.json({ documentId: newDoc.id, title: newDoc.title, summary: result.summary, topics: result.topics });
        } catch (e) { 
            console.error('❌ Database save failed:', e);
            res.status(500).json({ error: 'Failed to save analysis results' }); 
        }
    });
});

app.post('/api/chat', authenticateToken, async (req, res) => {
    const { documentId, query } = req.body;
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    await prisma.chatHistory.create({ data: { documentId, role: 'user', content: query } });
    const recentChats = await prisma.chatHistory.findMany({
        where: { documentId }, orderBy: { createdAt: 'desc' }, take: 6
    });
    const historyContext = recentChats.reverse().map(c => ({ role: c.role === 'user' ? 'user' : 'assistant', content: c.content }));

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a professional document assistant." },
            { role: "user", content: `Document Content:\n${doc.fullText}` },
            ...historyContext,
            { role: "user", content: query }
        ]
    });
    const answer = completion.choices[0].message.content;
    await prisma.chatHistory.create({ data: { documentId, role: 'ai', content: answer } });
    res.json({ answer });
});

app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true });
});

// === Admin API ===

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    const { search } = req.query;
    const users = await prisma.user.findMany({
        where: search ? { email: { contains: search, mode: 'insensitive' } } : {},
        select: { id: true, email: true, role: true, createdAt: true, _count: { select: { documents: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(users);
});

app.get('/api/admin/users/:userId/docs', authenticateToken, requireAdmin, async (req, res) => {
    const docs = await prisma.document.findMany({
        where: { userId: req.params.userId },
        select: { id: true, title: true, originalName: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
    });
    res.json(docs);
});

app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const targetUser = await prisma.user.findUnique({ 
            where: { id: req.params.userId } 
        });

        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        if (targetUser.role === 'admin' && req.user.email !== ROOT_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Cannot delete other administrators' });
        }

        if (targetUser.email === ROOT_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Cannot delete root admin' });
        }

        await prisma.user.delete({ where: { id: req.params.userId } });
        res.json({ success: true });

    } catch (e) {
        console.error("User deletion failed:", e);
        res.status(500).json({ error: "Deletion failed" });
    }
});

app.delete('/api/admin/documents/:docId', authenticateToken, requireAdmin, async (req, res) => {
    await prisma.document.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
});

app.post('/api/admin/register-admin', authenticateToken, requireRootAdmin, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) return res.status(400).json({ error: 'Invalid parameters' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await prisma.user.create({
            data: { email, password: hashedPassword, role: 'admin' }
        });
        res.json({ message: 'Admin account created successfully' });
    } catch (e) {
        res.status(400).json({ error: 'Email already registered' });
    }
});

async function initAdmin() {
    const existingAdmin = await prisma.user.findUnique({ where: { email: ROOT_ADMIN_EMAIL } });
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('!admin123', 10);
        await prisma.user.create({
            data: { email: ROOT_ADMIN_EMAIL, password: hashedPassword, role: 'admin' }
        });
        console.log(`🔒 Root Admin Created: ${ROOT_ADMIN_EMAIL}`);
    }
}

initAdmin().then(() => {
    app.listen(port, () => console.log(`🚀 Server running on: http://localhost:${port}`));
});