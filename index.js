require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    {
        name: 'upload',
        description: '獲取專屬上傳連結 (無視 Discord 大小限制)'
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
        // 使用者看到的私密訊息 (Ephemeral)
        const uploadUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        
        await interaction.reply({
            content: `👋 您好！為了支援超大檔案上傳，請點擊下方連結進入您的私密上傳通道：\n\n🔗 **[點我前往上傳頁面](${uploadUrl})**\n\n*(此連結僅您可見，上傳後後端將自動計算檔案大小)*`,
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
