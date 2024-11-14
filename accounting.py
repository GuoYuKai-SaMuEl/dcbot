import sqlite3
from datetime import datetime
def query_creditor(creditor):
    con = sqlite3.connect('accounting.db')
    cursor = con.cursor()
    cursor.execute(f'select * from accounting where creditor = \'{creditor}\'')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    return result
def query_debtor(debtor):
    con = sqlite3.connect('accounting.db')
    cursor = con.cursor()
    cursor.execute(f'select * from accounting where debtor = \'{debtor}\'')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    return result
def check(creditor,debtor,amount):
    con = sqlite3.connect('accounting.db')
    cursor = con.cursor()
    cursor.execute(f'select * from accounting where creditor = \'{creditor}\' and debtor = \'{debtor}\' and amount = \'{amount}\'')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    if result==[]:
        return False
    return True
def new(creditor,debtor,amount,reason='無'):
    con = sqlite3.connect('accounting.db')
    cursor = con.cursor()
    cursor.execute(f'insert into accounting (creditor, debtor, amount, reason, time)\
                                    values (\'{creditor}\', \'{debtor}\',\'{amount}\',\'{reason}\',\'{datetime.now()+datetime.timedelta(hours=8)}\')')
    cursor.close()
    con.commit()
    con.close()
def delete(creditor,debtor,amount):
    con = sqlite3.connect('accounting.db')
    cursor = con.cursor()
    cursor.execute(f'select * from accounting where time = (select min(time) from accounting where creditor = \'{creditor}\' and debtor = \'{debtor}\' and amount = {amount})')
    result = cursor.fetchone()
    cursor.execute(f'delete from accounting where time = (select min(time) from accounting where creditor = \'{creditor}\' and debtor = \'{debtor}\' and amount = {amount})')
    cursor.close()
    con.commit()
    con.close()
    return result
con = sqlite3.connect('accounting.db')
cursor = con.cursor()
cursor.execute('create table if not exists accounting (creditor text, debtor text, amount integer, reason text, time text)')
cursor.close()
con.commit()
con.close()