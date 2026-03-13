require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`正在清空伺服器 ${process.env.GUILD_ID} 的指令...`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: [] }
        );
        console.log('✅ 伺服器指令已成功清空！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 清空失敗:', error);
        process.exit(1);
    }
})();
