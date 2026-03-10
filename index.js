require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events,
    ApplicationCommandOptionType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- 指令註冊 ---
// 我們將上傳功能改為指令參數，這是目前最穩定且支援大檔案的方式
const commands = [
    {
        name: 'upload',
        description: '直接上傳檔案到我的後端',
        options: [
            {
                name: 'file',
                description: '請選擇要上傳的檔案',
                type: ApplicationCommandOptionType.Attachment,
                required: true
            },
            {
                name: 'description',
                description: '檔案描述',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('正在註冊斜線指令...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('成功註冊全域指令');
    } catch (error) {
        console.error('註冊指令失敗:', error);
    }
})();

// --- 機器人事件處理 ---
client.on(Events.ClientReady, () => {
    console.log(`目前登入身份 --> ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'upload') {
        // 先延遲回應，因為下載檔案可能需要時間
        await interaction.deferReply({ ephemeral: true });

        // 獲取參數
        const attachment = interaction.options.getAttachment('file');
        const description = interaction.options.getString('description') || '無';

        // --- 後端處理邏輯範例 ---
        console.log('--- 後端開始處理 ---');
        console.log(`檔名: ${attachment.name}`);
        console.log(`大小: ${attachment.size} bytes (${(attachment.size / 1024).toFixed(2)} KB)`);
        console.log(`內容類型: ${attachment.contentType}`);
        console.log(`描述: ${description}`);
        console.log('--- 處理完成 ---');

        // 建立儲存目錄
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }

        const filePath = path.join(uploadDir, attachment.name);
        
        try {
            // 下載檔案
            const response = await axios({
                method: 'get',
                url: attachment.url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                interaction.editReply({
                    content: `✅ **檔案上傳成功！**\n**檔名:** \`${attachment.name}\`\n**大小:** ${(attachment.size / 1024).toFixed(2)} KB\n**描述:** ${description}`
                });
            });

            writer.on('error', (err) => {
                throw err;
            });

        } catch (err) {
            console.error('下載失敗:', err);
            await interaction.editReply({ content: '❌ 存檔至後端時發生錯誤' });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
