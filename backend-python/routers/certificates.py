import os
import math
import hashlib
from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, extract
from typing import Optional
from datetime import datetime
import json

from core.database import get_db
from core.security import verify_admin_token
from models.models import Certificate, CertificateTemplate, CertificateHash, LoginSession, ActivityLog, BackgroundJob, VerificationLog, CertificateAuditLog
import uuid
import secrets
from schemas.schemas import IssueCertificateRequest, UpdateCertificateRequest, CertificateListResponse
from services.pdf_generator import generate_certificate_pdf, generate_certificate_qr
from services.storage import upload_to_r2
from services.email_service import send_certificate_email
from services.pusher_service import trigger_pusher_event
from services.signature_service import sign_data

router = APIRouter()

@router.get("/members")
def get_members(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    # Raw SQL since community_members isn't fully modeled in models.py, but let's just use raw connection for this 
    # since it belongs to another module.
    from core.database import get_db_connection
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, email, phone, role FROM community_members ORDER BY name ASC")
            members = cursor.fetchall()
            return {"success": True, "data": members}
    finally:
        conn.close()

def process_issue_certificate(req: IssueCertificateRequest, cert_id: str, job_id: str, db: Session):
    # Fetch job to update status
    job = db.query(BackgroundJob).filter(BackgroundJob.job_id == job_id).first()
    if job:
        job.status = 'Processing'
        db.commit()

    def update_status(status_str, progress_percent):
        if job:
            payload_data = json.loads(job.payload) if job.payload else {}
            payload_data['progress'] = progress_percent
            payload_data['status_text'] = status_str
            job.payload = json.dumps(payload_data)
            db.commit()
            
            trigger_pusher_event('private-eco-channel', 'job-progress', {
                'job_id': job_id,
                'cert_id': cert_id,
                'status': status_str,
                'progress': progress_percent
            })

    def log_audit(action, reason=None):
        audit = CertificateAuditLog(
            cert_id=cert_id,
            action=action,
            administrator='System',
            reason=reason
        )
        db.add(audit)
        db.commit()

    try:
        # Fetch template
        template = db.query(CertificateTemplate).filter(CertificateTemplate.id == req.template_id).first()
        
        # 1. Draft
        verification_token = secrets.token_urlsafe(16)
        cert = Certificate(
            cert_id=cert_id,
            recipient_type=req.recipient_type,
            recipient_name=req.recipient_name,
            recipient_email=req.recipient_email,
            recipient_phone=req.recipient_phone,
            recipient_zone=req.recipient_zone,
            certificate_type=req.certificate_type,
            issue_date=req.issue_date,
            citation=req.citation,
            issuing_authority=req.issuing_authority,
            co_signatory=req.co_signatory,
            template_id=req.template_id if req.template_id and req.template_id > 0 else None,
            status='Draft',
            verification_token=verification_token
        )
        db.add(cert)
        db.commit()
        log_audit('Draft', 'Initial record created')
        update_status('Draft', 10)
        
        # 2. PDF & QR Generation
        app_url = os.getenv("APP_URL", "https://suraksha-setu-chi.vercel.app").rstrip("/")
        verify_url = f"{app_url}/verify/{cert_id}"
        pdf_bytes = generate_certificate_pdf(
            cert_id, req.recipient_name, req.certificate_type, req.citation,
            req.issue_date, req.issuing_authority, verify_url
        )
        qr_bytes = generate_certificate_qr(verify_url)
        
        cert.status = 'Generated'
        db.commit()
        log_audit('Generated', 'PDF and QR generated')
        update_status('Generated', 30)
        
        # 3. Hash & Signature
        hash_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        cert.hash_sha256 = hash_sha256
        db.commit()
        
        cert_hash = CertificateHash(cert_id=cert_id, hash_sha256=hash_sha256)
        db.add(cert_hash)
        
        # Sign the hash for digital signature integrity
        signature, key_version = sign_data(hash_sha256, db)
        cert.signature_key_version = key_version
        cert.status = 'Signed'
        db.commit()
        log_audit('Signed', f'Digitally signed with key {key_version}')
        update_status('Signed', 50)
        
        # 4. Upload to Cloudflare R2
        object_key = f"certificates/{cert_id}.pdf"
        pdf_url = upload_to_r2(pdf_bytes, object_key, "application/pdf")
        
        qr_object_key = f"certificates/qr/{cert_id}.png"
        qr_url = upload_to_r2(qr_bytes, qr_object_key, "image/png")
        
        cert.pdf_url = pdf_url
        cert.qr_code_url = qr_url
        cert.status = 'Uploaded'
        db.commit()
        log_audit('Uploaded', 'Assets stored in Cloudflare R2')
        update_status('Uploaded', 70)
        
        # 5. Issue
        cert.status = 'Issued'
        
        if template:
            template.usage_count += 1
            template.last_used = datetime.now()
            
        if job:
            job.status = 'Completed'
            payload_data = json.loads(job.payload) if job.payload else {}
            payload_data['progress'] = 100
            payload_data['status_text'] = 'Completed'
            job.payload = json.dumps(payload_data)
            
        db.commit()
        log_audit('Issued', 'Certificate fully issued and active')
        
        # Trigger Pusher for new certificate
        if req.publish_to_feed == 1:
            trigger_pusher_event('private-eco-channel', 'new-certificate', {
                'cert_id': cert_id,
                'recipient': req.recipient_name,
                'type': req.certificate_type,
                'citation': req.citation
            })
            
        # 6. Send Email
        if req.send_email == 1 and req.recipient_email:
            send_certificate_email(req.recipient_email, req.recipient_name, req.certificate_type, cert_id, pdf_bytes)
            cert.status = 'Delivered'
            db.commit()
            log_audit('Delivered', f'Email sent to {req.recipient_email}')
            trigger_pusher_event('private-eco-channel', 'certificate-email-sent', {
                'cert_id': cert_id,
                'recipient_email': req.recipient_email
            })
            
    except Exception as e:
        db.rollback()
        print(f"Error processing certificate: {e}")
        if job:
            job.status = 'Failed'
            job.error_message = str(e)
            db.commit()
        log_audit('Failed', f'Error during issuance: {str(e)}')

@router.post("/", response_model=dict)
def issue_certificate(req: IssueCertificateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    date_obj = datetime.strptime(req.issue_date, "%Y-%m-%d")
    year = date_obj.strftime("%Y")
    prefix = 'SS-CERT'
    
    # Generate ID
    count = db.query(Certificate).filter(Certificate.cert_id.like(f"{prefix}-{year}-%")).count()
    seq = str(count + 1).zfill(6) # Format SS-CERT-2026-000001
    cert_id = f"{prefix}-{year}-{seq}"
    
    # Create BackgroundJob tracking record
    job_id = str(uuid.uuid4())
    job = BackgroundJob(
        job_id=job_id,
        job_type='issue_certificate',
        payload=json.dumps({"cert_id": cert_id, "recipient": req.recipient_name}),
        status='Pending'
    )
    db.add(job)
    db.commit()
    
    background_tasks.add_task(process_issue_certificate, req, cert_id, job_id, db)
    
    return {"success": True, "cert_id": cert_id, "job_id": job_id, "message": "Certificate generation queued in background."}

@router.get("/jobs/{job_id}", response_model=dict)
def get_job_status(job_id: str, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    job = db.query(BackgroundJob).filter(BackgroundJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "success": True,
        "job_id": job.job_id,
        "status": job.status,
        "error_message": job.error_message,
        "payload": json.loads(job.payload) if job.payload else None
    }

@router.get("/dashboard-stats", response_model=dict)
def get_dashboard_stats(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    today = datetime.now().date()
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    # We define 'This Week' as last 7 days
    from datetime import timedelta
    week_ago = today - timedelta(days=7)
    
    total = db.query(Certificate).count()
    active = db.query(Certificate).filter(Certificate.status.in_(['Issued', 'Delivered', 'Active'])).count()
    revoked = db.query(Certificate).filter(Certificate.status == 'Revoked').count()
    expired = db.query(Certificate).filter(Certificate.status == 'Expired').count()
    
    issued_today = db.query(Certificate).filter(Certificate.issue_date == today).count()
    issued_week = db.query(Certificate).filter(Certificate.issue_date >= week_ago).count()
    issued_month = db.query(Certificate).filter(
        extract('month', Certificate.issue_date) == current_month,
        extract('year', Certificate.issue_date) == current_year
    ).count()
    
    last_cert = db.query(Certificate).order_by(Certificate.created_at.desc()).first()
    
    delivery_success = db.query(Certificate).filter(Certificate.status == 'Delivered').count()
    
    return {
        "success": True,
        "data": {
            "total_issued": total,
            "active": active,
            "revoked": revoked,
            "expired": expired,
            "issued_today": issued_today,
            "issued_week": issued_week,
            "issued_month": issued_month,
            "delivery_success": delivery_success,
            "last_certificate": {
                "cert_id": last_cert.cert_id,
                "recipient_name": last_cert.recipient_name,
                "created_at": last_cert.created_at.strftime("%Y-%m-%d %H:%M:%S")
            } if last_cert else None
        }
    }

@router.get("/", response_model=CertificateListResponse)
def list_certificates(page: int = 1, limit: int = 10, search: str = '', type: str = 'All', status: str = 'All', db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    offset = (page - 1) * limit
    
    query = db.query(Certificate)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Certificate.cert_id.ilike(search_pattern),
                Certificate.recipient_name.ilike(search_pattern),
                Certificate.recipient_email.ilike(search_pattern),
                Certificate.hash_sha256.ilike(search_pattern),
                Certificate.verification_token.ilike(search_pattern),
                Certificate.issuing_authority.ilike(search_pattern)
            )
        )
        
    if type != 'All':
        query = query.filter(Certificate.certificate_type == type)
        
    if status != 'All':
        query = query.filter(Certificate.status == status)
        
    total = db.query(Certificate).count()
    active = db.query(Certificate).filter(Certificate.status == 'Active').count()
    revoked = db.query(Certificate).filter(Certificate.status == 'Revoked').count()
    
    current_month = datetime.now().month
    current_year = datetime.now().year
    this_month = db.query(Certificate).filter(
        extract('month', Certificate.issue_date) == current_month,
        extract('year', Certificate.issue_date) == current_year
    ).count()
    
    filtered_total = query.count()
    data = query.order_by(Certificate.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": data,
        "stats": {
            "total": total,
            "active": active,
            "revoked": revoked,
            "this_month": this_month
        },
        "pagination": {
            "total": filtered_total,
            "limit": limit,
            "page": page,
            "total_pages": math.ceil(filtered_total / limit)
        }
    }

@router.put("/{cert_id}/status", response_model=dict)
def update_certificate_status(cert_id: str, req: UpdateCertificateRequest, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    cert = db.query(Certificate).filter(Certificate.cert_id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    new_status = 'Revoked' if req.action == 'revoke' else 'Active'
    cert.status = new_status
    
    # Audit Log
    activity_log = ActivityLog(
        event_type=f"Certificate {new_status}",
        reference_id=cert_id,
        description=f"Status of certificate {cert_id} changed to {new_status} by admin.",
        category="Status Change",
        location="System"
    )
    db.add(activity_log)
    
    db.commit()
    
    return {"success": True}

@router.get("/{cert_id}/html", response_model=dict)
def get_issued_certificate_html(cert_id: str, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    cert = db.query(Certificate).filter(Certificate.cert_id == cert_id).first()
    if not cert:
        return {"success": False, "error": "Not found"}
        
    tmpl = db.query(CertificateTemplate).filter(CertificateTemplate.id == cert.template_id).first()
    
    html = tmpl.html_content if tmpl and tmpl.html_content else f"<h1>Certificate {cert.cert_id}</h1><p>Awarded to {cert.recipient_name}</p>"
    
    html = html.replace('{{NAME}}', cert.recipient_name)
    html = html.replace('{{AWARD_TYPE}}', cert.certificate_type)
    html = html.replace('{{DATE}}', str(cert.issue_date))
    html = html.replace('{{ISSUER}}', cert.issuing_authority)
    html = html.replace('{{CERTIFICATE_ID}}', cert.cert_id)
    html = html.replace('{{CITATION}}', cert.citation)
    
    if tmpl and tmpl.css_content:
        html = f"<style>{tmpl.css_content}</style>{html}"
        
    return {"success": True, "html_content": html}
