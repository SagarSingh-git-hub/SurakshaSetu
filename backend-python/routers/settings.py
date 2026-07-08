from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_admin_token
from models.models import SystemCertificateSetting
from schemas.schemas import SettingUpdate
from typing import List

router = APIRouter()

@router.get("/", response_model=dict)
def get_settings(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    settings = db.query(SystemCertificateSetting).all()
    # Format as key-value pairs
    data = {s.setting_key: s.setting_value for s in settings}
    return {"success": True, "settings": data}

@router.post("/", response_model=dict)
def update_settings(settings: List[SettingUpdate], db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    for setting in settings:
        db_setting = db.query(SystemCertificateSetting).filter(SystemCertificateSetting.setting_key == setting.key).first()
        if db_setting:
            db_setting.setting_value = setting.value
        else:
            new_setting = SystemCertificateSetting(setting_key=setting.key, setting_value=setting.value)
            db.add(new_setting)
    
    db.commit()
    return {"success": True}
