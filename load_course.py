import pandas as pd
import time
from selenium import webdriver
from bs4 import BeautifulSoup

from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def load_chrome():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    global chrome
    chrome = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    print('chrome load finish')

def load_data():
    global df
    df=pd.read_csv('course.csv',index_col=False)

def save_data():
    df.to_csv('course.csv', encoding='utf-8_sig',index=False)

def add_course(course_id):
    chrome.get('https://if177.aca.ntu.edu.tw/regquery/index.aspx')
    select = Select(chrome.find_element(By.NAME,'ctl00$MainContent$ddpKind'))
    select.select_by_value('4')
    id_input = chrome.find_element(By.NAME,'ctl00$MainContent$txtKeyWord')
    id_input.send_keys(course_id)
    submit_btn = chrome.find_element(By.NAME,'ctl00$MainContent$btnQuery')
    submit_btn.click()
    soup = BeautifulSoup(chrome.page_source, 'html.parser')
    result = soup.find('span',attrs={'id':'MainContent_lblResult'})
    if '1' in result.text:
        table = soup.find('table', attrs={'id':'MainContent_GridView1'})
        table_body = table.find('tbody')
        rows = table_body.find_all('tr')
        for row in rows:
            cols = row.find_all('td')
            if not cols:
                continue
            cols = [ele.text.strip() for ele in cols]
            if len(cols)<df.shape[1]:
                break
            df.loc[df.shape[0]]=cols
        save_data()
        return 1
    else:
        return 0

def query(course_id):
    for i in range(df.shape[0]):
        if df['流水號'][i]==course_id:
            return df.iloc[i]
    if add_course(str(course_id)):
        return df.iloc[df.shape[0]-1]
    return None

if __name__=='__main__':
    load_chrome()
    chrome.get("https://if177.aca.ntu.edu.tw/regquery/Reqcou.aspx")
    time.sleep(0.2)
    data = []
    col_name = []
    while True:
        soup = BeautifulSoup(chrome.page_source, 'html.parser')
        table = soup.find('table', attrs={'id':'MainContent_GridView1'})
        table_body = table.find('tbody')
        rows = table_body.find_all('tr')
        for row in rows:
            cols = row.find_all('td')
            if not cols:
                if data:
                    continue
                cols = row.find_all('th')
                col_name = [ele.text.strip() for ele in cols]
                continue
            cols = [ele.text.strip() for ele in cols]
            if data and len(cols)<len(data[0]):
                break
            data.append(cols)
        chrome.execute_script("__doPostBack('ctl00$MainContent$GridView1','Page$Next')")
        time.sleep(0.2)
        if not soup.find(text='下一頁'):
            break

    df=pd.DataFrame(data)
    df.columns=col_name
    print(df)
    df.to_csv('course.csv', encoding='utf-8_sig',index=False)
else:
    load_chrome()
    load_data()
