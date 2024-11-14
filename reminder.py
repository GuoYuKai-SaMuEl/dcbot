import sqlite3
def query_user(user):
    con = sqlite3.connect('reminder.db')
    cursor = con.cursor()
    cursor.execute(f'select * from every where user = \'{user}\'')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    return result
def query(day,time):
    con = sqlite3.connect('reminder.db')
    cursor = con.cursor()
    cursor.execute(f'select * from every where day = \'{day}\' and time = \'{time}\'')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    return result
def new(user,day,time,context):
    con = sqlite3.connect('reminder.db')
    cursor = con.cursor()
    cursor.execute(f'insert into every (user, day, time, context)\
                                values (\'{user}\', \'{day}\',\'{time}\',\'{context}\')')
    cursor.close()
    con.commit()
    con.close()
def delete(user,day,time,context=''):
    con = sqlite3.connect('reminder.db')
    cursor = con.cursor()
    if context=='':
        cursor.execute(f'select * from every where user = \'{user}\' and day = \'{day}\' and time = \'{time}\'')
    else:
        cursor.execute(f'select * from every where user = \'{user}\' and day = \'{day}\' and time = \'{time}\' and context = \'{context}\'')
    result = cursor.fetchall()
    if context=='':
        cursor.execute(f'delete from every where user = \'{user}\' and day = \'{day}\' and time = \'{time}\'')
    else:
        cursor.execute(f'delete from every where user = \'{user}\' and day = \'{day}\' and time = \'{time}\' and context = \'{context}\'')
    cursor.close()
    con.commit()
    con.close()
    return result
def init_channel():
    con = sqlite3.connect('reminder.db')
    cursor = con.cursor()
    cursor.execute(f'select * from channel')
    result = cursor.fetchall()
    cursor.close()
    con.commit()
    con.close()
    return result
con = sqlite3.connect('reminder.db')
cursor = con.cursor()
cursor.execute('create table if not exists every (user text,day int,time int,context text)')
cursor.execute('create table if not exists channel (id int)')
if __name__=='__main__':
    id=int(input('input channel id'))
    cursor.execute(f'insert into channel (id) values (\'{id}\')')
cursor.close()
con.commit()
con.close()