import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from urllib.parse import quote_plus

db_host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "localhost"
db_user = os.getenv("DB_USERNAME") or os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root"
db_pass = os.getenv("DB_PASSWORD") or os.getenv("DB_PASS") or os.getenv("MYSQLPASSWORD") or ""
db_name = os.getenv("DB_DATABASE") or os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "eco_warrior"
db_port = int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or 3307)

app_env = os.getenv("APP_ENV", "development")

# Build connection string
# For PyMySQL, the dialect is mysql+pymysql
encoded_pass = quote_plus(db_pass)
if encoded_pass:
    db_url = f"mysql+pymysql://{db_user}:{encoded_pass}@{db_host}:{db_port}/{db_name}"
else:
    db_url = f"mysql+pymysql://{db_user}@{db_host}:{db_port}/{db_name}"

# Add SSL for Aiven or Production
connect_args = {}
if app_env == 'production' or 'aivencloud.com' in db_host:
    connect_args = {"ssl": {}}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# For raw connection where still needed during transition
def get_db_connection():
    import pymysql.cursors
    ssl = None
    if app_env == 'production' or 'aivencloud.com' in db_host:
        ssl = {'ssl': {}}
    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database=db_name,
        port=db_port,
        cursorclass=pymysql.cursors.DictCursor,
        ssl=ssl
    )
