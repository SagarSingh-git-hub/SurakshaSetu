from fastapi import Header, HTTPException
from core.database import get_db_connection

def verify_admin_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")
    
    token = authorization.split(" ")[1]
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT user_id, ip_address, status FROM login_sessions WHERE token = %s LIMIT 1", (token,))
            res = cursor.fetchone()
            
            if not res or res['status'] != 'Active':
                raise HTTPException(status_code=401, detail="Session expired or invalid.")
            
            role = 'Super Admin' if res['user_id'] == 'admin@surakshasetu.org' else 'Admin'
            
            return {
                "email": res['user_id'],
                "role": role,
                "ip_address": res['ip_address'],
                "token": token
            }
    finally:
        conn.close()
