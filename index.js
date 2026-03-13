require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events,
    Partials
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
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

const commands = [
    {
        name: 'upload',
        description: '上傳檔案並在頻道公開分享直接下載連結',
        integration_types: [0, 1],
        contexts: [0, 1, 2]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/**
 * 💡 指令管理邏輯
 * 如果您看到重複的指令，請先取消下方「清空舊指令」部分的註解並執行一次。
 */
(async () => {
    try {
        console.log('--- 指令同步程序開始 ---');

        // 【清空舊指令專區】: 如果要徹底清除重複指令，請取消下面這兩行的註解並執行一次，然後再重新註冊
        // console.log('正在強制清空伺服器指令...');
        // await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] });
        // console.log('正在強制清空全域指令...');
        // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });

        if (process.env.GUILD_ID) {
            console.log(`正在同步伺服器指令 [Guild: ${process.env.GUILD_ID}]...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('✅ 伺服器指令同步成功 (立即生效)');
        } else {
            console.log('正在同步全域指令 (Global Commands)...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('✅ 全域指令已發送 (同步可能需要 1 小時)');
        }
        console.log('------------------------');
    } catch (error) {
        console.error('❌ 指令同步失敗:', error);
    }
})();

// --- 2. 初始化 Express Server ---
const app = express();
const PORT = 6567;
app.use(cors());
app.use(express.static('public'));

// 增加 body 解析限制 (雖然主要用 multer 處理，但這是保險)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const TEMP_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => {
        const requestId = req.body.request_id || 'unknown';
        // 修正：將 latin1 轉碼回 utf8 處理中文檔名
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${requestId}-${Date.now()}-${originalName}`);
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/upload', upload.single('file'), (req, res) => {
    const { request_id, channel_id, user_id } = req.body;
    
    if (!req.file) return res.status(400).json({ success: false, message: '❌ 沒有選擇檔案' });

    // 修正：同樣在此處轉碼
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log(`[Request: ${request_id}] 收到來自使用者 ${user_id} 的檔案: ${originalName}`);

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

        // 2. 嘗試發送 Discord 訊息 (優先使用互動回應，備援為頻道/私訊發送)
        try {
            const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
            const fileSizeKB = (req.file.size / 1024).toFixed(2);
            const sizeDisplay = fileSizeMB >= 1 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

            const messageContent = `✅ **檔案上傳完成！**\n上傳者: <@${user_id}>\n檔名: \`${originalName}\` (${sizeDisplay})\n🔗 **[點我直接下載](${rawUrl})**`;
            
            const cachedInteraction = interactionCache.get(request_id);

            if (cachedInteraction) {
                console.log(`[Diagnostic: ${request_id}] 偵測到有效的互動快取，正在執行 followUp...`);
                await cachedInteraction.followUp({
                    content: messageContent,
                    ephemeral: false // 公開顯示在該視窗中
                });
                console.log(`[Diagnostic: ${request_id}] followUp 發送成功。`);
                interactionCache.delete(request_id);
            } else {
                console.log(`[Diagnostic: ${request_id}] 互動快取已過期或不存在，嘗試備援發送路徑...`);
                
                // 備援：嘗試直接發送至頻道或使用者
                try {
                    const channel = await client.channels.fetch(channel_id);
                    await channel.send(messageContent);
                    console.log(`[Diagnostic: ${request_id}] 備援頻道發送成功。`);
                } catch (err) {
                    console.log(`[Diagnostic: ${request_id}] 備援頻道發送失敗: ${err.message}，改發私訊...`);
                    const user = await client.users.fetch(user_id);
                    await user.send(messageContent);
                    console.log(`[Diagnostic: ${request_id}] 備援私訊發送成功。`);
                }
            }
        } catch (discordError) {
            console.error(`[Diagnostic: ${request_id}] Discord 所有發送路徑皆失敗:`, discordError.message);
        }

        res.json({ success: true, download_url: rawUrl });
    });
});

// --- 3. 啟動服務 ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'upload') {
        const requestId = uuidv4();
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:6567';
        
        interactionCache.set(requestId, interaction);
        setTimeout(() => interactionCache.delete(requestId), 15 * 60 * 1000);

        const uploadUrl = `${baseUrl}?request_id=${requestId}&channel_id=${interaction.channelId}&user_id=${interaction.user.id}`;
        
        await interaction.reply({
            content: `👋 您好！請點擊連結開始上傳檔案：\n🔗 **[前往上傳頁面](${uploadUrl})**\n*(完成後會在此頻道分享連結)*`,
            ephemeral: true
        });
    }
});

const interactionCache = new Map();

client.login(process.env.DISCORD_TOKEN).then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 機器人與伺服器已啟動 (Port: ${PORT})`);
    });

    // 關鍵：將伺服器超時時間設為 10 分鐘 (處理大檔案)
    server.timeout = 600000;
    server.keepAliveTimeout = 600000;
    server.headersTimeout = 601000;
});
