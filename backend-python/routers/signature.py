from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_admin_token
from models.models import SignatureKey
from services.signature_service import generate_rsa_key_pair

router = APIRouter()

@router.get("/keys", response_model=dict)
def list_keys(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    keys = db.query(SignatureKey).order_by(SignatureKey.created_at.desc()).all()
    return {
        "success": True, 
        "data": [{
            "kid": k.kid,
            "status": k.status,
            "created_at": k.created_at,
            # we do not expose private key!
        } for k in keys]
    }

@router.post("/rotate", response_model=dict)
def rotate_keys(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    new_key = generate_rsa_key_pair(db)
    return {"success": True, "message": "Key rotated successfully", "kid": new_key.kid}
