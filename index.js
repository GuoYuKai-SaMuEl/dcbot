require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Events, Partials } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// --- 1. 初始化 Discord Bot ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel]
});

const interactionCache = new Map();

// --- 2. 初始化 Express Server ---
const app = express();
const PORT = 6567;
app.use(cors());
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

const TEMP_DIR = path.join(__dirname, 'temp_uploads');
const CHUNKS_DIR = path.join(__dirname, 'temp_chunks');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR);

// 顯式設定 multer 限制為 10GB
const upload = multer({ 
    dest: CHUNKS_DIR,
    limits: { fileSize: 10 * 1024 * 1024 * 1024 } 
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- 碎片接收端點 ---
app.post('/upload-chunk', upload.single('chunk'), async (req, res) => {
    const { request_id, chunk_index, total_chunks, filename } = req.body;
    const chunkPath = req.file.path;
    const targetDir = path.join(CHUNKS_DIR, request_id);

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);

    // 將碎片重新命名為序號
    const finalChunkPath = path.join(targetDir, chunk_index.toString());
    fs.renameSync(chunkPath, finalChunkPath);

    // 修正：使用 decodeURIComponent 解碼前端傳來的編碼檔名
    const originalName = decodeURIComponent(filename);
    console.log(`[Chunk: ${request_id}] 接收 ${originalName} 碎片 ${chunk_index}/${total_chunks}`);

    // 檢查是否所有碎片都到齊了
    if (fs.readdirSync(targetDir).length === parseInt(total_chunks)) {
        console.log(`[Chunk: ${request_id}] 碎片到齊，準備進入背景合併與同步...`);
        
        res.json({ success: true, message: '同步處理中', status: 'processing' });

        (async () => {
            const finalFilePath = path.join(TEMP_DIR, `${request_id}-${originalName}`);
            const writeStream = fs.createWriteStream(finalFilePath);

            for (let i = 0; i < total_chunks; i++) {
                const partPath = path.join(targetDir, i.toString());
                const data = fs.readFileSync(partPath);
                writeStream.write(data);
                fs.unlinkSync(partPath);
            }
            writeStream.end();

            writeStream.on('finish', () => {
                try { fs.rmdirSync(targetDir); } catch(e) {}
                processFinalFile(request_id, finalFilePath, originalName, req.body);
            });
        })();
        
        return;
    }

    res.json({ success: true, message: '碎片上傳成功' });
});

// 處理最終合併後的檔案並發送到雲端
function processFinalFile(request_id, filePath, originalName, meta) {
    const { channel_id, user_id } = meta;
    const cliPath = process.env.STORAGETO_PATH || 'storageto';
    const command = `bash -l -c '${cliPath} upload "${filePath}" --json'`;

    console.log(`[Request: ${request_id}] 正在同步至雲端平台...`);

    exec(command, async (error, stdout, stderr) => {
        const fileSize = fs.statSync(filePath).size;
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (error) {
            console.error('CLI 錯誤:', stderr);
            return;
        }

        try {
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            const result = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
            const fileInfo = result.FileInfo || result.file_info;
            const rawUrl = fileInfo?.raw_url || fileInfo?.RawUrl || fileInfo?.url || fileInfo?.Url;

            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
            const fileSizeKB = (fileSize / 1024).toFixed(2);
            const sizeDisplay = fileSizeMB >= 1 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

            const messageContent = `✅ **檔案上傳完成！**\n上傳者: <@${user_id}>\n檔名: \`${originalName}\` (${sizeDisplay})\n🔗 **[點我直接下載](${rawUrl})**`;
            
            const cachedInteraction = interactionCache.get(request_id);
            if (cachedInteraction) {
                await cachedInteraction.followUp({ content: messageContent, ephemeral: false });
                interactionCache.delete(request_id);
            } else {
                const channel = await client.channels.fetch(channel_id);
                await channel.send(messageContent);
            }
        } catch (err) {
            console.error('處理最終結果失敗:', err);
        }
    });
}

// --- 3. 啟動服務 ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'upload') {
        const requestId = uuidv4();
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:6567';
        interactionCache.set(requestId, interaction);
        setTimeout(() => interactionCache.delete(requestId), 15 * 60 * 1000);
        const uploadUrl = `${baseUrl}?request_id=${requestId}&channel_id=${interaction.channelId}&user_id=${interaction.user.id}`;
        await interaction.reply({ content: `👋 上傳連結已備妥：\n🔗 **[點此開始上傳](${uploadUrl})**`, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 分片上傳伺服器已啟動 (Port: ${PORT})`));
});
