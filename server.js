const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

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
            // 即使錯誤也要回傳 JSON
            return res.status(500).json({ 
                success: false, 
                message: '❌ 平台同步失敗，請確認伺服器已安裝 storageto cli' 
            });
        }

        try {
            const result = JSON.parse(stdout);
            const downloadUrl = result.file_info.url;

            console.log(`[Request: ${requestId}] 上傳完成: ${downloadUrl}`);
            
            // 成功回傳 JSON
            res.json({
                success: true,
                message: '✅ 上傳成功',
                download_url: downloadUrl
            });
        } catch (parseError) {
            console.error('解析 CLI 輸出失敗:', stdout);
            res.status(500).json({ success: false, message: '❌ 解析平台結果失敗' });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 後端伺服器已啟動：http://localhost:${PORT}`);
});
