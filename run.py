import discord
from discord.ext import commands,tasks
#import pandas as pd
#import random
#import load_course
import accounting
import reminder
import wheather
import asyncio
import datetime
import requests
intents = discord.Intents.all()
bot = commands.Bot(command_prefix='/',intents=intents)

@bot.event
async def on_ready():
    await bot.sync_commands(guild_ids=[1206260664742580234])
    print(f"目前登入身份 --> {bot.user}")
    clock.start()
@bot.event
async def on_message(message: discord.Message):
    print(message)
    if '笑死' in message.content:
        await message.channel.send(file=discord.File('lol.jpg'))
        #await message.channel.send('<:lol:1305463357830332446>')
@bot.slash_command(name="借", description = "借錢給某人")
async def 借(interaction: discord.Interaction,誰:discord.User,金額:int,註記:str='無'):
    if 金額==0:
        await interaction.response.send_message('金額0是殺小，不要搞我好嗎')
        return
    if 金額<0:
        await interaction.response.send_message('要不要看看你打了殺小，不要搞我好嗎')
        return
    if 誰==interaction.author:
        await interaction.response.send_message('跟自己借錢是殺小，不要搞我好嗎')
        return
    message=await interaction.response.send_message(f'<@{interaction.author.id}>借<@{誰.id}>{金額}元，註記:{註記}，若確認有進行借錢請在10秒內按✅')
    msg = await message.original_response()
    await msg.add_reaction("✅")
    await asyncio.sleep(10)
    msg = await interaction.channel.fetch_message(msg.id)
    for reaction in msg.reactions:
        if reaction.emoji=='✅':
            async for user in reaction.users():
                if user==誰:
                    accounting.new(interaction.author.id,誰.id,金額,註記)
                    await interaction.followup.send('對方已確認，記帳成功')
                    return
    await interaction.followup.send('對方未確認，記帳失敗')

@bot.slash_command(name="欠", description = "欠某人錢")
async def 欠(interaction: discord.Interaction,誰:discord.User,金額:int,註記:str='無'):
    if 金額==0:
        await interaction.response.send_message('金額0是殺小，不要搞我好嗎')
        return
    if 金額<0:
        await interaction.response.send_message('要不要看看你打了殺小，不要搞我好嗎')
        return
    if 誰==interaction.author:
        await interaction.response.send_message('欠自己錢是殺小，不要搞我好嗎')
        return
    accounting.new(誰.id,interaction.author.id,金額,註記)
    await interaction.response.send_message(f'<@{誰.id}>借<@{interaction.author.id}>{金額}元，註記:{註記}')

@bot.slash_command(name="還", description = "還錢給某人")
async def 還(interaction: discord.Interaction,誰:discord.User,金額:int):
    if 金額==0:
        await interaction.response.send_message('金額0是殺小，不要搞我好嗎')
        return
    if 金額<0:
        await interaction.response.send_message('要不要看看你打了殺小，不要搞我好嗎')
        return
    if 誰==interaction.author:
        await interaction.response.send_message('還自己錢是殺小，不要搞我好嗎')
        return
    if not accounting.check(誰.id,interaction.author.id,金額):
        await interaction.response.send_message(f'查無<@{interaction.author.id}>欠<@{誰.id}>{金額}元的紀錄，目前僅支援一次償還整筆債務的功能，請確認後再試')
        return
    message=await interaction.response.send_message(f'<@{interaction.author.id}>還<@{誰.id}>{金額}元，若確認有收到還錢請在10秒內按✅')
    msg = await message.original_response()
    await msg.add_reaction("✅")
    await asyncio.sleep(10)
    msg = await interaction.channel.fetch_message(msg.id)
    for reaction in msg.reactions:
        if reaction.emoji=='✅':
            async for user in reaction.users():
                if user==誰:
                    t=accounting.delete(誰.id,interaction.author.id,金額)
                    await interaction.followup.send('對方已確認，還錢成功，刪除以下紀錄\n'+f"<@{t[0]}>借<@{t[1]}>{t[2]}元，註記:{t[3]}，時間:{t[4]}")
                    return
    await interaction.followup.send('對方未確認，還錢失敗')

@bot.slash_command(name="收", description = "收某人錢")
async def 收(interaction: discord.Interaction,誰:discord.User,金額:int):
    if 金額==0:
        await interaction.response.send_message('金額0是殺小，不要搞我好嗎')
        return
    if 金額<0:
        await interaction.response.send_message('要不要看看你打了殺小，不要搞我好嗎')
        return
    if 誰==interaction.author:
        await interaction.response.send_message(f'好窩，<@{interaction.author.id}>收了<@{interaction.author.id}>{金額}元')
        return
    if not accounting.check(interaction.author.id,誰.id,金額):
        await interaction.response.send_message(f'查無<@{誰.id}>欠<@{interaction.author.id}>{金額}元的紀錄，目前僅支援一次償還整筆債務的功能，請確認後再試')
        return
    t=accounting.delete(interaction.author.id,誰.id,金額)
    await interaction.send_message('收錢成功，刪除以下紀錄\n'+f"<@{t[0]}>借<@{t[1]}>{t[2]}元，註記:{t[3]}，時間:{t[4]}")
    return

@bot.slash_command(name="查", description = "查詢借錢、欠錢紀錄")
async def 查(interaction: discord.Interaction):
    result_creditor=accounting.query_creditor(interaction.author.id)
    result_debtor=accounting.query_debtor(interaction.author.id)
    if result_creditor==[] and result_debtor==[]:
        await interaction.response.send_message('您目前沒有欠錢或借別人錢的紀錄歐',ephemeral=True)
        return
    await interaction.response.send_message(
        '\n'.join([f"<@{t[0]}>借<@{t[1]}>{t[2]}元，註記:{t[3]}，時間:{t[4]}" for t in result_creditor])
        +'\n\n'+
        '\n'.join([f"<@{t[0]}>借<@{t[1]}>{t[2]}元，註記:{t[3]}，時間:{t[4]}" for t in result_debtor]),ephemeral=True)
@bot.slash_command(name="提醒我每週", description = "每週的特定時間發送提醒")
async def 提醒我每週(interaction: discord.Interaction,週幾:int,幾點:int,幾分:int,什麼事:str):
    if not 1<=週幾<=7 or not 0<=幾分<60 or not 0<=幾點<24:
        await interaction.response.send_message('時間設定錯誤，請確認後再試',ephemeral=True)
        return
    reminder.new(interaction.author.id,週幾,幾點*100+幾分,什麼事)
    await interaction.response.send_message(f'成功設定在每週{週幾}的{幾點}點{幾分}分提醒{什麼事}\n如果想查詢目前設定了哪些提醒可以使用/提醒查，想刪除可以使用/提醒刪')
@bot.slash_command(name="提醒查", description = "查詢設定的提醒清單")
async def 提醒查(interaction: discord.Interaction):
    reminderlist=reminder.query_user(interaction.author.id)
    if reminderlist==[]:
        await interaction.response.send_message('您目前沒有設定任何提醒歐！',ephemeral=True)
    else:
        await interaction.response.send_message('\n'.join([f"每週{t[1]}的{t[2]//100}點{t[2]%100}分提醒{t[3]}" for t in reminderlist]),ephemeral=True)
@bot.slash_command(name="提醒刪", description = "刪除設定的提醒，若未指定什麼事則刪除時間吻合的所有提醒")
async def 提醒刪(interaction: discord.Interaction,週幾:int,幾點:int,幾分:int,什麼事:str=''):
    if not 1<=週幾<=7 or not 0<=幾分<60 or not 0<=幾點<24:
        await interaction.response.send_message('時間設定錯誤，請確認後再試',ephemeral=True)
        return
    reminderlist=reminder.delete(interaction.author.id,週幾,幾點*100+幾分,什麼事)
    if reminderlist==[]:
        await interaction.response.send_message('沒有任何提醒被刪除',ephemeral=True)
    else:
        await interaction.response.send_message('刪除以下提醒\n'\
            +'\n'.join([f"每週{t[1]}的{t[2]//100}點{t[2]%100}分提醒{t[3]}" for t in reminderlist]),ephemeral=True)
'''
async def 通識(ctx):
    cnt=0
    await ctx.send('流水號 課程名稱 登記人數 名額 中獎率')
    for i in range(df.shape[0]):
        cnt+=1
        if cnt>5:
            break
        await ctx.send(f"{df['流水號'][i]} {df['課程名稱'][i]:>30} {df['登記人數'][i]} {df['餘剩名額'][i]} {df['餘剩名額'][i]/df['登記人數'][i]*100 if df['餘剩名額'][i]<df['登記人數'][i] else 100:5}%")

@bot.tree.command(name = "會上嗎", description = "依照課程流水號查詢課程，並依據登記人數與名額擲筊檢測你會不會上")
async def 會上嗎(interaction: discord.Interaction,流水號:int):
    data=load_course.query(流水號)
    if data is not None:
        mes=f"課程名稱:{data['課程名稱']} 登記人數:{data['登記人數']} 名額:{data['餘剩名額']} 中獎率:{data['餘剩名額']/data['登記人數']*100 if data['餘剩名額']<data['登記人數'] else 100}%\n擲筊中..."
        await interaction.response.send_message(mes)
        if data['登記人數']==0:
            mes='\n抱歉，此課程初選不開放'
        else:
            time.sleep(0.5)
            mes='\n恭喜你選上了！！' if random.randint(1,data['登記人數'])<=data['餘剩名額'] else '\n你沒選上，再接再厲，也許下次就能選上'
        await interaction.followup.send(mes)
        return
    await interaction.response.send_message('找不到餒對不擠')
'''
@tasks.loop(seconds=25)
async def clock():
    global dt
    ndt=datetime.datetime.now()+datetime.timedelta(hours=8)
    if dt==None or (dt.isoweekday(),dt.hour,dt.minute)!=(ndt.isoweekday(),ndt.hour,ndt.minute):
        dt=ndt
        #print('now is',dt.isoweekday(),dt.hour,dt.minute)
        reminder_channel=bot.get_channel(1305898770789306504)
        wheater_channel=bot.get_channel(1306119394728083487)
        reminderlist=reminder.query(dt.isoweekday(),dt.hour*100+dt.minute)
        for t in reminderlist:
            await reminder_channel.send(f'提醒<@{t[0]}>現在是週{t[1]}的{t[2]//100}點{t[2]%100}分，記得要{t[3]}歐！')
        if 9<=dt.hour<=21 and dt.hour%2==0 and dt.minute==0:
            report=wheather.get_now()
            if report!=None:
                await wheater_channel.send(report)
        if 9<=dt.hour<=21 and dt.minute%30==0:
            report=wheather.get_warning()
            if report!=None:
                await wheater_channel.send(report)
        if 9<=dt.hour<=21 and dt.minute%10==0:
            report=wheather.get_typhoon()
            global last_typhoon_report
            if report!=None and last_typhoon_report!=report[0]:
                last_typhoon_report=report[0]
                await wheater_channel.send(report[1])
                try:
                    img = requests.get('https://www.cwa.gov.tw'+report[2]).content
                    with open('typhoon.jpg', 'wb') as handler:
                        handler.write(img)
                    await wheater_channel.send(file=discord.File('typhoon.jpg'))
                except:
                    print('img error')

dt=None
last_typhoon_report=None
apikeyfile = open("dcbotkey.txt", "r")
apikey = apikeyfile.read()
bot.run(apikey)