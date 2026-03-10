require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events
} = require('discord.js');
const { v4: uuidv4 } = require('uuid'); // 請執行 npm install uuid

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    {
        name: 'upload',
        description: '獲取專屬上傳連結並取得外部下載連結'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('正在刷新斜線指令...');
        
        if (process.env.GUILD_ID) {
            // 優先註冊為伺服器指令 (立即生效)
            console.log(`偵測到 GUILD_ID，正在同步伺服器專屬指令 [Guild: ${process.env.GUILD_ID}]...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('✅ 伺服器指令同步成功 (立即生效)');
        } else {
            // 註冊為全域指令 (可能需等待 1 小時)
            console.log('正在同步全域指令 (Global Commands)...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('✅ 全域指令已發送 (預計 1 小時內生效)');
        }
    } catch (error) {
        console.error('指令同步發生錯誤:', error);
    }
})();

client.on(Events.ClientReady, () => {
    console.log(`目前登入身份 --> ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'upload') {
        const requestId = uuidv4();
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        const uploadUrl = `${baseUrl}?request_id=${requestId}`;
        
        await interaction.reply({
            content: `👋 您好！\n您的專屬上傳連結已準備就緒（Request ID: \`${requestId}\`）：\n\n🔗 **[點我前往上傳頁面](${uploadUrl})**\n\n*(檔案將上傳至 Storage.to 平台並回傳連結)*`,
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
