import os

def process_file(file_path):
    """
    後端處理檔案的邏輯
    這裡可以放置您的 AI 評測、格式檢查或其他後端運算
    """
    if not os.path.exists(file_path):
        print(f"[後端] 錯誤：找不到檔案 {file_path}")
        return False

    # 獲取檔案大小 (bytes)
    file_size = os.path.getsize(file_path)
    
    # 印出處理資訊 (如使用者要求)
    print(f"--- 後端開始處理 ---")
    print(f"檔案路徑: {file_path}")
    print(f"檔案大小: {file_size} bytes ({file_size / 1024:.2f} KB)")
    print(f"--- 處理完成 ---")
    
    return True
