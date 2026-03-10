require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// --- 1. 初始化 Discord Bot ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    {
        name: 'upload',
        description: '獲取上傳連結，完成後 Bot 會自動回傳下載連結'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('正在刷新斜線指令...');
        await rest.put(
            process.env.GUILD_ID 
                ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
                : Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ 指令同步成功');
    } catch (error) {
        console.error(error);
    }
})();

// --- 2. 初始化 Express Server ---
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.static('public'));

const TEMP_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => {
        const requestId = req.body.request_id || 'unknown';
        cb(null, `${requestId}-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// 提供上傳頁面
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 處理檔案上傳
app.post('/upload', upload.single('file'), (req, res) => {
    const { request_id, channel_id, user_id } = req.body;
    
    if (!req.file) return res.status(400).json({ success: false, message: '❌ 沒有選擇檔案' });

    console.log(`[Request: ${request_id}] 收到來自使用者 ${user_id} 的檔案: ${req.file.originalname}`);

    const cliPath = process.env.STORAGETO_PATH || 'storageto';
    const command = `bash -l -c '${cliPath} upload "${req.file.path}" --json'`;

    exec(command, async (error, stdout, stderr) => {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (error) {
            console.error('CLI 錯誤:', stderr);
            return res.status(500).json({ success: false, message: '❌ 平台同步失敗' });
        }

        try {
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            const result = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
            
            const fileInfo = result.FileInfo || result.file_info;
            const rawUrl = fileInfo.raw_url; // 使用直接下載連結

            // --- 關鍵：讓 Bot 在 Discord 發送訊息 ---
            const channel = await client.channels.fetch(channel_id);
            if (channel) {
                await channel.send({
                    content: `✅ **檔案上傳完成！**\n上傳者: <@${user_id}>\n檔名: \`${req.file.originalname}\`\n直接下載連結: ${rawUrl}`
                });
            }

            res.json({ success: true, download_url: rawUrl });
        } catch (parseError) {
            res.status(500).json({ success: false, message: '❌ 解析失敗' });
        }
    });
});

// --- 3. 啟動服務 ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'upload') {
        const requestId = uuidv4();
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        
        // 將頻道與使用者資訊帶入 URL 參數
        const uploadUrl = `${baseUrl}?request_id=${requestId}&channel_id=${interaction.channelId}&user_id=${interaction.user.id}`;
        
        await interaction.reply({
            content: `🔗 **[請點此前往專屬上傳頁面](${uploadUrl})**\n完成後我會直接將連結發送至此頻道。`,
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 機器人與伺服器已同步啟動 (Port: ${PORT})`);
    });
});
