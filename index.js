require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events,
    Partials // 新增 Partials 支援
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// --- 1. 初始化 Discord Bot ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages // 新增私訊意圖
    ],
    partials: [Partials.Channel] // 私訊必備設定
});

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
const PORT = 6567;
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

        let rawUrl = '';
        try {
            // 1. 解析 JSON
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) throw new Error('找不到 JSON 內容');

            const cleanJson = stdout.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(cleanJson);
            const fileInfo = result.FileInfo || result.file_info;
            rawUrl = fileInfo?.raw_url || fileInfo?.RawUrl || fileInfo?.url || fileInfo?.Url;
            
            if (!rawUrl) throw new Error('解析成功但找不到下載連結');

            console.log(`[Request: ${request_id}] 上傳成功，URL: ${rawUrl}`);
        } catch (parseError) {
            console.error(`[Request: ${request_id}] 解析失敗:`, parseError.message);
            return res.status(500).json({ success: false, message: `❌ 解析失敗: ${parseError.message}` });
        }

        // 2. 嘗試發送 Discord 訊息 (雙重機制：頻道失敗則改私訊)
        try {
            let target;
            try {
                // 優先嘗試發送到頻道
                target = await client.channels.fetch(channel_id);
            } catch (err) {
                console.log(`[Request: ${request_id}] 獲取頻道失敗 (${err.message})，準備嘗試私訊...`);
            }

            const messagePayload = {
                content: `✅ **檔案上傳完成！**\n上傳者: <@${user_id}>\n檔名: \`${req.file.originalname}\`\n直接下載連結: ${rawUrl}`
            };

            if (target) {
                // 診斷：檢查機器人在該頻道的權限
                const permissions = target.permissionsFor(client.user);
                console.log(`[Request: ${request_id}] 頻道權限檢查: ViewChannel=${permissions.has('ViewChannel')}, SendMessages=${permissions.has('SendMessages')}`);

                // 嘗試在頻道發送
                await target.send(messagePayload).catch(async (err) => {
                    console.error(`[Request: ${request_id}] 頻道發送失敗 (${err.message})，嘗試私訊使用者...`);
                    const user = await client.users.fetch(user_id);
                    await user.send(messagePayload);
                });
            }
 else {
                // 如果抓不到頻道，直接嘗試私訊
                const user = await client.users.fetch(user_id);
                await user.send(messagePayload);
            }
        } catch (discordError) {
            console.error(`[Request: ${request_id}] Discord 所有發送路徑皆失敗:`, discordError.message);
            return res.json({ 
                success: true, 
                message: `✅ 上傳成功，但 Discord 訊息發送失敗 (${discordError.message})`,
                download_url: rawUrl 
            });
        }

        res.json({ success: true, download_url: rawUrl });
    });
});

// --- 3. 啟動服務 ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'upload') {
        const requestId = uuidv4();
        // 修正：確保 BACKEND_URL 如果沒設定，預設指向 6567 而不是 3000
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:6567';
        
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
