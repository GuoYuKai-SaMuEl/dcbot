import requests
import datetime
import time
from selenium import webdriver
from bs4 import BeautifulSoup
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
def load_chrome():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    global chrome
    chrome = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    print('chrome load finish')
def get_warning():
    now=datetime.datetime.now()+datetime.timedelta(hours=8)
    url=f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization={apikey}&locationName=%E8%87%BA%E5%8C%97%E5%B8%82"
    try:
        response=requests.get(url)
        if response.status_code==200:
            posts = response.json()
            if posts['records']['location'][0]['hazardConditions']['hazards']==[]:
                return None
                #return f'依據中央氣象署資料，目前{now.hour}時{now.minute}分，台北市沒有發布任何天氣警報！'
            else:
                return f'依據中央氣象署資料，目前{now.hour}時{now.minute}分，台北市發布'+\
                    '、'.join([f'{t['info']['phenomena']}'for t in posts['records']['location'][0]['hazardConditions']['hazards']])+\
                    '警報!請注意安全!'
        else:
            print('API error!')
            return None
    except:
        print('unexcepted error!')
        return None
def get_now():
    now=datetime.datetime.now()+datetime.timedelta(hours=8)
    url1=f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?Authorization={apikey}&StationId=466920"
    url2=f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization={apikey}&StationId=466920"
    try:
        response1=requests.get(url1)
        response2=requests.get(url2)
        if response1.status_code==200 and response2.status_code==200:
            posts = response1.json()
            result = posts['records']['Station'][0]['WeatherElement']
            posts = response2.json()
            return f'依據中央氣象署資料，目前{now.hour}時{now.minute}分，台北市天氣{result['Weather']}，氣溫{result['AirTemperature']}攝氏度，風速{result['WindSpeed']}m/s，過去10分鐘降水量{posts['records']['Station'][0]['RainfallElement']['Past10Min']['Precipitation']}mm'
        else:
            print('API error!')
            return None
    except:
        print('unexcepted error!')
        return None
def get_typhoon_web():
    try:
        chrome.get("https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_WARN.html")
        time.sleep(1)
        soup = BeautifulSoup(chrome.page_source, 'html.parser')
        result = soup.find_all('div',attrs={'class':'col-md-6'})
        re1=None
        for row in result:
            if row.find('h3'):
                re1=row
                break
        result = soup.find('ul',attrs={'class':'list-unstyled typ-nowlist'})
        return re1,result.get_text(separator='\n')
    except:
        print('spider error')
        return None
def get_typhoon():
    typhoon_web=get_typhoon_web()
    if typhoon_web==None:
        return None
    try:
        return typhoon_web[0].find('span').get_text(),f"## 中央氣象署在{typhoon_web[0].find('p').get_text()[5:]}發布{typhoon_web[0].find('h3').get_text()} {typhoon_web[0].find('span').get_text()}，大略內容如下：\n{typhoon_web[1]}",typhoon_web[0].find('img')['src']
    except:
        print('web error')
        return None
load_chrome()
apikeyfile = open("apikey.txt", "r")
apikey = apikeyfile.read()
if __name__=='__main__':
    # print(get_typhoon())
    # print(get_now())
    # print(get_warning())
    pass