from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_admin_token
from models.models import ActivityLog, BackgroundJob, CertificateAuditLog
from datetime import datetime, timedelta

router = APIRouter()

def run_cleanup(db: Session):
    threshold = datetime.now() - timedelta(days=1)
    db.query(BackgroundJob).filter(
        BackgroundJob.status.in_(['Completed', 'Failed']),
        BackgroundJob.updated_at < threshold
    ).delete(synchronize_session=False)
    db.commit()

@router.post("/cleanup", response_model=dict)
def cleanup_old_jobs(background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    background_tasks.add_task(run_cleanup, db)
    return {"success": True, "message": "Cleanup job queued."}

@router.get("/", response_model=dict)
def get_activity_logs(limit: int = 50, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "event_type": log.event_type,
            "reference_id": log.reference_id,
            "description": log.description,
            "category": log.category,
            "location": log.location,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
        
    return {
        "success": True,
        "data": data
    }

@router.get("/certificate/{cert_id}", response_model=dict)
def get_certificate_audit_logs(cert_id: str, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    logs = db.query(CertificateAuditLog).filter(CertificateAuditLog.cert_id == cert_id).order_by(CertificateAuditLog.timestamp.desc()).all()
    
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "cert_id": log.cert_id,
            "action": log.action,
            "administrator": log.administrator,
            "ip_address": log.ip_address,
            "reason": log.reason,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        })
        
    return {
        "success": True,
        "data": data
    }
