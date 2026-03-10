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

// 設定暫時存檔目錄
const TEMP_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// 使用磁碟儲存，因為 CLI 工具需要一個實體路徑
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        // 使用 Request ID (如果有的話) 或 TimeStamp
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
        return res.status(400).send('❌ 沒有選擇任何檔案');
    }

    const requestId = req.body.request_id || 'unknown';
    const filePath = req.file.path;

    console.log(`[Request: ${requestId}] 收到檔案: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`正在呼叫 storageto CLI 上傳...`);

    // 執行 storageto CLI
    // 使用 --json 方便解析結果
    const command = `storageto upload "${filePath}" --json`;

    exec(command, (error, stdout, stderr) => {
        // 無論成功失敗，都刪除暫存檔
        fs.unlink(filePath, (err) => {
            if (err) console.error('刪除暫存檔失敗:', err);
        });

        if (error) {
            console.error(`[Request: ${requestId}] CLI 錯誤:`, stderr);
            return res.status(500).send('❌ 平台同步失敗，請稍後再試');
        }

        try {
            const result = JSON.parse(stdout);
            const downloadUrl = result.file_info.url;

            console.log(`[Request: ${requestId}] 上傳完成！連結: ${downloadUrl}`);
            
            res.json({
                success: true,
                message: '✅ 上傳成功',
                download_url: downloadUrl,
                size: req.file.size
            });
        } catch (parseError) {
            console.error('解析 CLI 輸出失敗:', stdout);
            res.status(500).send('❌ 解析平台回傳結果失敗');
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 後端伺服器已啟動：http://localhost:${PORT}`);
});
