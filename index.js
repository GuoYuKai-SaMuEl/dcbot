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
        description: '上傳檔案並在頻道公開分享直接下載連結'
    }
];

// 用來暫存互動物件 (Interaction Cache)
// 因為 Discord 的 Interaction Token 有效期約 15 分鐘，適合處理上傳任務
const interactionCache = new Map();

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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/upload', upload.single('file'), (req, res) => {
    const { request_id, channel_id, user_id } = req.body;
    
    if (!req.file) return res.status(400).json({ success: false, message: '❌ 沒有選擇檔案' });

    console.log(`[Request: ${request_id}] 收到來自使用者 ${user_id} 的檔案，準備同步並發送公開連結`);

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
            const result = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
            const fileInfo = result.FileInfo || result.file_info;
            rawUrl = fileInfo?.raw_url || fileInfo?.RawUrl || fileInfo?.url || fileInfo?.Url;
        } catch (parseError) {
            return res.status(500).json({ success: false, message: '❌ 解析失敗' });
        }

        // --- 核心變動：使用 followUp 發送公開訊息 ---
        try {
            const cachedInteraction = interactionCache.get(request_id);
            const messageContent = `📤 **檔案上傳完成！**\n上傳者: <@${user_id}>\n檔名: \`${req.file.originalname}\`\n🔗 **[點我直接下載](${rawUrl})**`;

            if (cachedInteraction) {
                // 使用 followUp，預設 ephemeral 為 false，所以是公開的
                await cachedInteraction.followUp({
                    content: messageContent,
                    ephemeral: false
                });
                interactionCache.delete(request_id); // 任務完成，移除快取
            } else {
                // 如果快取不見了（例如重啟或過期超過 15 分鐘），則回退到一般頻道發送
                const channel = await client.channels.fetch(channel_id);
                if (channel) await channel.send(messageContent);
            }
        } catch (discordError) {
            console.error(`Discord 發送失敗:`, discordError.message);
            // 最後防線：嘗試直接私訊使用者
            try {
                const user = await client.users.fetch(user_id);
                await user.send(`✅ 上傳成功，但頻道發送失敗。您的連結為: ${rawUrl}`);
            } catch (dmErr) { console.error('私訊也失敗'); }
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
        
        // 1. 將互動物件存入快取
        interactionCache.set(requestId, interaction);

        // 2. 15 分鐘後自動清理快取（避免記憶體洩漏）
        setTimeout(() => interactionCache.delete(requestId), 15 * 60 * 1000);

        const uploadUrl = `${baseUrl}?request_id=${requestId}&channel_id=${interaction.channelId}&user_id=${interaction.user.id}`;
        
        // 3. 回傳隱私訊息給使用者
        await interaction.reply({
            content: `👋 您好！\n請點擊下方連結開始上傳檔案：\n🔗 **[前往上傳頁面](${uploadUrl})**\n\n*(完成後，我會在此頻道發送一個所有人可見的下載連結)*`,
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 機器人與伺服器已啟動 (Port: ${PORT})`);
    });
});
