const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000; // 您可以在 EC2 的 Security Group 中開啟 3000 port

app.use(cors());
app.use(express.static('public'));

// 使用記憶體儲存 (不寫入硬碟)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 1. 首頁：提供上傳介面 (稍後會建立這個 HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. 上傳端點：處理檔案上傳
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('❌ 沒有選擇任何檔案');
    }

    // --- 後端處理邏輯範例 ---
    console.log('\n--- Web Server 收到檔案 ---');
    console.log(`檔名: ${req.file.originalname}`);
    console.log(`類型: ${req.file.mimetype}`);
    console.log(`大小: ${req.file.size} bytes (${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log('狀態: 已從記憶體處理完畢，未寫入硬碟。');
    console.log('---------------------------\n');

    res.send(`✅ 上傳成功！伺服器已處理完畢 (${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 後端伺服器已啟動：http://localhost:${PORT}`);
    console.log(`請確保您的 EC2 外部 IP 的 ${PORT} Port 已開啟。`);
});
