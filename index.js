require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    FileUploadBuilder, // 2026 年新組件
    ComponentType,
    Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- 指令註冊 ---
const commands = [
    {
        name: 'upload',
        description: '上傳檔案到我的後端 (Modal 介面)'
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
        console.error(error);
    }
})();

// --- 機器人事件處理 ---
client.on(Events.ClientReady, () => {
    console.log(`目前登入身份 --> ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    // 1. 處理斜線指令
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'upload') {
            // 建立 Modal
            const modal = new ModalBuilder()
                .setCustomId('upload_modal')
                .setTitle('檔案上傳至後端');

            // 檔案上傳組件 (2026 版本)
            const fileInput = new FileUploadBuilder()
                .setCustomId('file_upload_field')
                .setLabel('請選擇檔案 (上限 10MB)')
                .setMinValues(1)
                .setMaxValues(1)
                .setRequired(true);

            // 描述輸入框
            const descInput = new TextInputBuilder()
                .setCustomId('file_description')
                .setLabel('檔案描述')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            // 將組件加入 ActionRows
            const row1 = new ActionRowBuilder().addComponents(fileInput);
            const row2 = new ActionRowBuilder().addComponents(descInput);

            modal.addComponents(row1, row2);

            // 顯示 Modal
            await interaction.showModal(modal);
        }
    }

    // 2. 處理 Modal 提交
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'upload_modal') {
            await interaction.deferReply({ ephemeral: true });

            // 獲取上傳的檔案 (Collection of Attachment)
            const files = interaction.fields.getUploadedFiles('file_upload_field');
            const description = interaction.fields.getTextInputValue('file_description');

            if (!files || files.size === 0) {
                return interaction.followUp({ content: '❌ 未偵測到上傳檔案', ephemeral: true });
            }

            const attachment = files.first();
            
            // --- 後端處理邏輯範例 ---
            console.log('--- 後端開始處理 (JS) ---');
            console.log(`檔名: ${attachment.name}`);
            console.log(`大小: ${attachment.size} bytes (${(attachment.size / 1024).toFixed(2)} KB)`);
            console.log(`描述: ${description || '無'}`);
            console.log('--- 處理完成 ---');

            // 儲存檔案到本地 (模擬後端存檔)
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir);
            }

            const filePath = path.join(uploadDir, attachment.name);
            
            try {
                const response = await axios({
                    method: 'get',
                    url: attachment.url,
                    responseType: 'stream'
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on('finish', () => {
                    interaction.followUp({
                        content: `✅ **檔案已成功存入後端！**\n**檔名:** \`${attachment.name}\`\n**大小:** ${(attachment.size / 1024).toFixed(2)} KB`,
                        ephemeral: true
                    });
                });
            } catch (err) {
                console.error('下載檔案失敗:', err);
                await interaction.followUp({ content: '❌ 存檔至後端時發生錯誤', ephemeral: true });
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
