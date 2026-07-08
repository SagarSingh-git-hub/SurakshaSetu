import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from core.database import get_db
from core.security import verify_admin_token
from models.models import CertificateGenerationSetting, CertificateSecurityLog, LoginSession

router = APIRouter()

DEFAULT_SETTINGS = {
    "qr_settings": {
        "error_correction": "M",
        "size_px": 300,
        "margin": 4,
        "embed_logo": True,
        "logo_size": 20,
        "fg_color": "#000000",
        "bg_color": "#ffffff",
        "url_format": "/verify/{certificate_id}",
        "auto_generate": True
    },
    "pdf_settings": {
        "engine": "ReportLab",
        "page_size": "A4",
        "orientation": "Landscape",
        "resolution": 150,
        "compression": "Medium",
        "color_profile": "sRGB",
        "font_embedding": True,
        "embed_metadata": True,
        "optimize": True,
        "naming": "SS-CERT-{year}-{id}.pdf"
    },
    "branding_settings": {
        "default_footer": "Verifiable securely at SurakshaSetu.",
        "verification_footer": "Scanned copy",
        "official_website": "https://surakshasetu.org",
        "default_signature_block": "Authorized Signatory",
        "default_seal": True,
        "watermark_text": "SURAKSHA SETU",
        "watermark_opacity": 0.1,
        "watermark_position": "Center",
        "header_logo_pos": "Top Left",
        "footer_alignment": "Center"
    },
    "output_preferences": {
        "auto_qr": True,
        "auto_pdf": True,
        "upload_r2": True,
        "auto_email": False,
        "publish_feed": False,
        "download_after": False,
        "retain_local": True
    },
    "performance_settings": {
        "cache_qr": True,
        "parallel_pdf": False,
        "optimize_images": True,
        "strip_metadata": False,
        "auto_cleanup": True,
        "retention_hours": 12
    },
    "storage_settings": {
        "provider": "Cloudflare R2"
    }
}

@router.get("")
async def get_settings(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    admin = verify_admin_token(token, db)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    setting = db.query(CertificateGenerationSetting).first()
    if not setting:
        return DEFAULT_SETTINGS

    return {
        "qr_settings": json.loads(setting.qr_settings) if setting.qr_settings else DEFAULT_SETTINGS["qr_settings"],
        "pdf_settings": json.loads(setting.pdf_settings) if setting.pdf_settings else DEFAULT_SETTINGS["pdf_settings"],
        "branding_settings": json.loads(setting.branding_settings) if setting.branding_settings else DEFAULT_SETTINGS["branding_settings"],
        "output_preferences": json.loads(setting.output_preferences) if setting.output_preferences else DEFAULT_SETTINGS["output_preferences"],
        "performance_settings": json.loads(setting.performance_settings) if setting.performance_settings else DEFAULT_SETTINGS["performance_settings"],
        "storage_settings": json.loads(setting.storage_settings) if setting.storage_settings else DEFAULT_SETTINGS["storage_settings"]
    }

@router.post("")
async def save_settings(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    admin = verify_admin_token(token, db)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    session = db.query(LoginSession).filter(LoginSession.token == token).first()
    admin_name = session.user_id if session else "Admin"

    data = await request.json()
    setting = db.query(CertificateGenerationSetting).first()
    
    if not setting:
        setting = CertificateGenerationSetting()
        db.add(setting)
        
    setting.qr_settings = json.dumps(data.get("qr_settings", {}))
    setting.pdf_settings = json.dumps(data.get("pdf_settings", {}))
    setting.branding_settings = json.dumps(data.get("branding_settings", {}))
    setting.output_preferences = json.dumps(data.get("output_preferences", {}))
    setting.performance_settings = json.dumps(data.get("performance_settings", {}))
    setting.storage_settings = json.dumps(data.get("storage_settings", {}))
    setting.updated_by = admin_name
    setting.updated_at = datetime.utcnow()
    
    db.commit()

    # Log action
    log = CertificateSecurityLog(
        action="Configuration Updated",
        performed_by=admin_name,
        description="QR and PDF Generation settings were updated."
    )
    db.add(log)
    db.commit()

    return {"status": "success"}

@router.post("/reset")
async def reset_settings(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    admin = verify_admin_token(token, db)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    session = db.query(LoginSession).filter(LoginSession.token == token).first()
    admin_name = session.user_id if session else "Admin"

    setting = db.query(CertificateGenerationSetting).first()
    if setting:
        db.delete(setting)
        
        # Log action
        log = CertificateSecurityLog(
            action="Configuration Reset",
            performed_by=admin_name,
            description="QR and PDF Generation settings were reset to defaults."
        )
        db.add(log)
        db.commit()

    return {"status": "success"}

@router.get("/export")
async def export_settings(request: Request, db: Session = Depends(get_db)):
    settings = await get_settings(request, db)
    return settings

@router.post("/sample")
async def generate_sample(request: Request, db: Session = Depends(get_db)):
    return {"status": "success", "message": "Sample generated successfully (mocked)."}
