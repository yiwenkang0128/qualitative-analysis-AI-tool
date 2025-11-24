const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const port = 3001;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// === API 1: 上传并创建新对话 ===
app.post('/api/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    
    // ✨ 获取前端传来的 title
    const title = req.body.title || req.file.originalname; 

    const pdfPath = req.file.path;
    console.log(`📂 收到文件: ${req.file.filename} (标题: ${title})，开始分析...`);

    const pythonProcess = spawn('./venv/bin/python', ['analyze.py', pdfPath]);
    
    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => dataString += data.toString());
    pythonProcess.stderr.on('data', (data) => errorString += data.toString());

    pythonProcess.on('close', async (code) => {
        if (code !== 0) {
            console.error('❌ 分析失败:', errorString);
            return res.status(500).json({ error: '分析过程出错', details: errorString });
        }

        try {
            const result = JSON.parse(dataString);
            
            console.log("💾 正在保存到数据库...");
            const newDoc = await prisma.document.create({
                data: {
                    title: title, // ✨ 存入标题
                    originalName: req.file.originalname,
                    serverFilename: req.file.filename,
                    fullText: result.fullText || "",
                    summary: result.summary,
                    topicsJson: JSON.stringify(result.topics)
                }
            });

            console.log(`✅ 数据库保存成功! ID: ${newDoc.id}`);

            res.json({
                documentId: newDoc.id,
                title: newDoc.title,
                summary: result.summary,
                topics: result.topics
            });

        } catch (e) {
            console.error('❌ 数据保存失败:', e);
            res.status(500).json({ error: '数据库保存失败' });
        }
    });
});

// === API 2: 聊天接口 ===
app.post('/api/chat', async (req, res) => {
    const { documentId, query } = req.body;
    if (!documentId || !query) return res.status(400).json({ error: '缺少参数' });

    try {
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) return res.status(404).json({ error: '找不到该文档' });

        // 保存用户问题
        await prisma.chatHistory.create({
            data: { documentId, role: 'user', content: query }
        });

        // 查找最近的 6 条聊天记录作为上下文 (Memory)
        const recentChats = await prisma.chatHistory.findMany({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
            take: 6
        });
        // 倒序回来，因为发给 API 要按时间正序
        const historyContext = recentChats.reverse().map(c => ({
            role: c.role === 'user' ? 'user' : 'assistant',
            content: c.content
        }));

        // 构造 Prompt
        const messages = [
            { role: "system", content: "你是一个专业的文档助手。请根据提供的文档全文回答问题。" },
            { role: "user", content: `文档全文(前10万字):\n${doc.fullText}` }, // 铺垫背景
            ...historyContext, // 插入历史记忆
            { role: "user", content: query } // 当前问题
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages
        });

        const answer = completion.choices[0].message.content;

        // 保存 AI 回答
        await prisma.chatHistory.create({
            data: { documentId, role: 'ai', content: answer }
        });

        res.json({ answer });

    } catch (e) {
        console.error("聊天接口出错:", e);
        res.status(500).json({ error: "服务器繁忙" });
    }
});

// === ✨ API 3: 获取会话列表 (用于侧边栏) ===
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await prisma.document.findMany({
            select: {
                id: true,
                title: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'desc' // 最新的在最上面
            }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "获取列表失败" });
    }
});

// === ✨ API 4: 获取单个会话详情 (用于点击切换) ===
app.get('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({
            where: { id },
            include: {
                chats: {
                    orderBy: { createdAt: 'asc' } // 按时间正序加载聊天记录
                }
            }
        });
        
        if (!doc) return res.status(404).json({ error: "未找到" });

        res.json({
            id: doc.id,
            title: doc.title,
            summary: doc.summary,
            topics: JSON.parse(doc.topicsJson || '[]'),
            chatHistory: doc.chats
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "加载详情失败" });
    }
});

// === ✨ API 5: 删除会话 ===
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.document.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "删除失败" });
    }
});

app.listen(port, () => {
    console.log(`🚀 数据库版后端运行在: http://localhost:${port}`);
});