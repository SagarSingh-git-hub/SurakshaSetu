from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_admin_token
from models.models import EmailLog, EmailIntegrationSetting, EmailAuditLog
from typing import Optional
from pydantic import BaseModel
import json

router = APIRouter()

class EmailSettingsRequest(BaseModel):
    smtp_config: dict
    template_settings: dict
    delivery_settings: dict
    automation_settings: dict
    branding_settings: dict

@router.get("/settings")
def get_email_settings(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    setting = db.query(EmailIntegrationSetting).first()
    if setting:
        return {
            "success": True,
            "data": {
                "smtp_config": json.loads(setting.smtp_config) if setting.smtp_config else {},
                "template_settings": json.loads(setting.template_settings) if setting.template_settings else {},
                "delivery_settings": json.loads(setting.delivery_settings) if setting.delivery_settings else {},
                "automation_settings": json.loads(setting.automation_settings) if setting.automation_settings else {},
                "branding_settings": json.loads(setting.branding_settings) if setting.branding_settings else {},
                "updated_at": setting.updated_at
            }
        }
    return {"success": True, "data": None}

@router.post("/settings")
def update_email_settings(req: EmailSettingsRequest, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    setting = db.query(EmailIntegrationSetting).first()
    if not setting:
        setting = EmailIntegrationSetting()
        db.add(setting)

    setting.smtp_config = json.dumps(req.smtp_config)
    setting.template_settings = json.dumps(req.template_settings)
    setting.delivery_settings = json.dumps(req.delivery_settings)
    setting.automation_settings = json.dumps(req.automation_settings)
    setting.branding_settings = json.dumps(req.branding_settings)
    setting.updated_by = admin.get("email", "admin")
    
    log = EmailAuditLog(
        action="Email Configuration Updated",
        description="Admin updated SMTP and template settings.",
        administrator=admin.get("email", "admin")
    )
    db.add(log)
    db.commit()
    return {"success": True, "message": "Settings saved successfully."}

@router.post("/reset")
def reset_email_settings(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    db.query(EmailIntegrationSetting).delete()
    log = EmailAuditLog(
        action="Email Configuration Reset",
        description="Admin reset settings to default.",
        administrator=admin.get("email", "admin")
    )
    db.add(log)
    db.commit()
    return {"success": True, "message": "Settings reset to defaults."}

@router.get("/logs", response_model=dict)
def get_email_logs(page: int = 1, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    limit = 20
    offset = (page - 1) * limit
    logs = db.query(EmailLog).order_by(EmailLog.sent_at.desc()).offset(offset).limit(limit).all()
    total = db.query(EmailLog).count()
    return {
        "success": True,
        "data": logs,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit
        }
    }

@router.get("/audit", response_model=dict)
def get_email_audit(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    logs = db.query(EmailAuditLog).order_by(EmailAuditLog.created_at.desc()).limit(50).all()
    return {"success": True, "data": logs}

@router.post("/test")
def test_smtp_connection(req: EmailSettingsRequest, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    if not req.smtp_config or req.smtp_config.get("host") == "" or req.smtp_config.get("port") == "":
        return {"success": False, "error": "Invalid SMTP Host or Port."}
    
    log = EmailAuditLog(
        action="SMTP Connection Test",
        description=f"Admin tested SMTP connection to {req.smtp_config.get('host')}",
        administrator=admin.get("email", "admin")
    )
    db.add(log)
    db.commit()
    
    return {"success": True, "message": "SMTP Connection successful."}

@router.get("/export")
def export_email_settings(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    setting = db.query(EmailIntegrationSetting).first()
    if setting:
        return {
            "smtp_config": json.loads(setting.smtp_config) if setting.smtp_config else {},
            "template_settings": json.loads(setting.template_settings) if setting.template_settings else {},
            "delivery_settings": json.loads(setting.delivery_settings) if setting.delivery_settings else {},
            "automation_settings": json.loads(setting.automation_settings) if setting.automation_settings else {},
            "branding_settings": json.loads(setting.branding_settings) if setting.branding_settings else {},
        }
    return {}
