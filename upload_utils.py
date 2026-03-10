import discord
import os
import processor

class UploadModal(discord.ui.Modal):
    def __init__(self) -> None:
        super().__init__(title="檔案上傳介面")
        
        # 使用 Py-cord 2.7+ 的 FileUpload 元件
        # 注意：這是 2026 年初 Discord 新增的原生功能
        self.add_item(
            discord.ui.FileUpload(
                label="請選擇要上傳的檔案 (上限 10MB)",
                min_values=1,
                max_values=1,
                required=True
            )
        )
        
        self.add_item(
            discord.ui.InputText(
                label="檔案描述",
                placeholder="請輸入關於這個檔案的說明...",
                required=False,
                style=discord.InputTextStyle.long
            )
        )

    async def callback(self, interaction: discord.Interaction):
        # 獲取上傳的檔案 (這是一個 Attachment 物件的列表)
        uploaded_files = self.children[0].values
        description = self.children[1].value
        
        if not uploaded_files:
            await interaction.response.send_message("❌ 未偵測到上傳檔案", ephemeral=True)
            return

        attachment = uploaded_files[0]
        
        # 建立儲存目錄 (模擬後端儲存)
        if not os.path.exists("uploads"):
            os.makedirs("uploads")
            
        file_path = os.path.join("uploads", attachment.filename)
        
        # 下載並儲存檔案
        await attachment.save(file_path)
        
        # 呼叫後端處理邏輯
        processor.process_file(file_path)
        
        await interaction.response.send_message(
            f"✅ **上傳成功！**\n"
            f"**檔名:** `{attachment.filename}`\n"
            f"**大小:** {attachment.size / 1024:.2f} KB\n"
            f"**描述:** {description if description else '無'}",
            ephemeral=True
        )

class UploadView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="點擊開啟上傳按鈕", style=discord.ButtonStyle.primary, emoji="📁")
    async def upload_button_callback(self, button: discord.ui.Button, interaction: discord.Interaction):
        # 當按鈕被點擊時，彈出 Modal 介面
        await interaction.response.send_modal(UploadModal())
