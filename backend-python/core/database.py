import os
import pymysql
import pymysql.cursors

def get_db_connection():
    db_host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "localhost"
    db_user = os.getenv("DB_USERNAME") or os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root"
    db_pass = os.getenv("DB_PASSWORD") or os.getenv("DB_PASS") or os.getenv("MYSQLPASSWORD") or ""
    db_name = os.getenv("DB_DATABASE") or os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "eco_warrior"
    db_port = int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or 3307)
    
    app_env = os.getenv("APP_ENV", "development")
    ssl = None
    if app_env == 'production' or 'aivencloud.com' in db_host:
        ssl = {'ssl': {}}

    connection = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database=db_name,
        port=db_port,
        cursorclass=pymysql.cursors.DictCursor,
        ssl=ssl
    )
    return connection
