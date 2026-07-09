import os
import pymysql
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

db_host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "localhost"
db_user = os.getenv("DB_USERNAME") or os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root"
db_pass = os.getenv("DB_PASSWORD") or os.getenv("DB_PASS") or os.getenv("MYSQLPASSWORD") or ""
db_name = os.getenv("DB_DATABASE") or os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "eco_warrior"
db_port = int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or 3307)

conn = pymysql.connect(
    host=db_host,
    user=db_user,
    password=db_pass,
    database=db_name,
    port=db_port
)

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS digital_signature_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_version VARCHAR(50) UNIQUE NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    passphrase_hash VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rotated_at DATETIME NULL
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS certificate_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cert_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    administrator VARCHAR(100) DEFAULT 'System',
    ip_address VARCHAR(45) NULL,
    reason TEXT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cert_id) REFERENCES certificates(cert_id) ON DELETE CASCADE
);
""")
conn.commit()
conn.close()
print("Creates done.")
