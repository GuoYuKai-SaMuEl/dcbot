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
