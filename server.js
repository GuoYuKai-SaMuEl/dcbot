const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 6567;

app.use(cors());
app.use(express.static('public'));

const TEMP_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const requestId = req.body.request_id || 'unknown';
        cb(null, `${requestId}-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: '❌ 沒有選擇任何檔案' });
    }

    const requestId = req.body.request_id || 'unknown';
    const filePath = req.file.path;

    console.log(`[Request: ${requestId}] 收到檔案: ${req.file.originalname}`);

    // 使用 bash -l -c 來強制載入使用者環境變數 (例如 .bashrc 中的 PATH)
    const cliPath = process.env.STORAGETO_PATH || 'storageto';
    const command = `bash -l -c '${cliPath} upload "${filePath}" --json'`;

    exec(command, (error, stdout, stderr) => {
        // 刪除暫存檔
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (error) {
            console.error(`[Request: ${requestId}] CLI 錯誤:`, stderr || error.message);
            return res.status(500).json({ 
                success: false, 
                message: '❌ 平台同步失敗，請確認伺服器已安裝 storageto cli' 
            });
        }

        try {
            // --- 強化解析邏輯：過濾 stdout 中的雜訊 ---
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('輸出內容中找不到有效的 JSON 格式');
            }

            const cleanJson = stdout.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(cleanJson);
            
            // 修正：使用 PascalCase 欄位名稱 (FileInfo)
            const fileInfo = result.FileInfo || result.file_info;
            const downloadUrl = fileInfo ? fileInfo.url : null;

            if (!downloadUrl) {
                throw new Error('JSON 解析成功，但找不到下載連結 (FileInfo.url)');
            }

            console.log(`[Request: ${requestId}] 上傳完成: ${downloadUrl}`);
            
            res.json({
                success: true,
                message: '✅ 上傳成功',
                download_url: downloadUrl
            });
        } catch (parseError) {
            console.error(`[Request: ${requestId}] 解析失敗:`, parseError.message);
            console.error('原始輸出內容:', stdout);
            res.status(500).json({ 
                success: false, 
                message: `❌ 解析結果失敗: ${parseError.message}`,
                raw_output: stdout // 回傳給前端方便調試
            });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 後端伺服器已啟動：http://localhost:${PORT}`);
});
