from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.models import LoginSession

def verify_admin_token(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")
    
    token = authorization.split(" ")[1]
    
    session_record = db.query(LoginSession).filter(LoginSession.token == token).first()
    
    if not session_record or session_record.status != 'Active':
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    
    role = 'Super Admin' if session_record.user_id == 'admin@surakshasetu.org' else 'Admin'
    
    return {
        "email": session_record.user_id,
        "role": role,
        "ip_address": session_record.ip_address,
        "token": token
    }
