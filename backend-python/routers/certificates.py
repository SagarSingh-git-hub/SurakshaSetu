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
from models.models import Certificate, CertificateTemplate, CertificateHash, LoginSession
from schemas.schemas import IssueCertificateRequest, UpdateCertificateRequest, CertificateListResponse
from services.pdf_generator import generate_certificate_pdf
from services.storage import upload_to_r2
from services.email_service import send_certificate_email
from services.pusher_service import trigger_pusher_event
from services.signature_service import sign_data

router = APIRouter()

@router.get("/members")
def get_members(db: Session = Depends(get_db)):
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

def process_issue_certificate(req: IssueCertificateRequest, cert_id: str, db: Session):
    try:
        # Fetch template
        template = db.query(CertificateTemplate).filter(CertificateTemplate.id == req.template_id).first()
        
        # PDF Generation
        verify_url = f"https://surakshasetu.org/verify?id={cert_id}"
        pdf_bytes = generate_certificate_pdf(
            cert_id, req.recipient_name, req.certificate_type, req.citation,
            req.issue_date, req.issuing_authority, verify_url
        )
        
        year = datetime.strptime(req.issue_date, "%Y-%m-%d").strftime("%Y")
        object_key = f"certificates/{year}/{cert_id}.pdf"
        pdf_url = upload_to_r2(pdf_bytes, object_key, "application/pdf")
        
        # Hash & Signature
        hash_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        
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
            pdf_url=pdf_url,
            hash_sha256=hash_sha256,
            status='Active'
        )
        db.add(cert)
        
        # Add to certificate_hashes table
        cert_hash = CertificateHash(
            cert_id=cert_id,
            hash_sha256=hash_sha256
        )
        db.add(cert_hash)
        
        # Sign the hash for digital signature integrity
        # sign_data(hash_sha256, db) # Only sign, signature verification uses hash
        
        if template:
            template.usage_count += 1
            template.last_used = datetime.now()
            
        db.commit()
        
        # Send Email
        if req.send_email == 1 and req.recipient_email:
            send_certificate_email(req.recipient_email, req.recipient_name, req.certificate_type, cert_id, pdf_bytes)
            
        # Trigger Pusher
        if req.publish_to_feed == 1:
            trigger_pusher_event('private-eco-channel', 'new-certificate', {
                'cert_id': cert_id,
                'recipient': req.recipient_name,
                'type': req.certificate_type,
                'citation': req.citation
            })
            
    except Exception as e:
        db.rollback()
        print(f"Error processing certificate: {e}")

@router.post("/", response_model=dict)
def issue_certificate(req: IssueCertificateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    date_obj = datetime.strptime(req.issue_date, "%Y-%m-%d")
    year = date_obj.strftime("%Y")
    prefix = 'SS-CERT'
    
    # Generate ID
    count = db.query(Certificate).filter(Certificate.cert_id.like(f"{prefix}-{year}-%")).count()
    seq = str(count + 1).zfill(6) # Format SS-CERT-2026-000001
    cert_id = f"{prefix}-{year}-{seq}"
    
    background_tasks.add_task(process_issue_certificate, req, cert_id, db)
    
    return {"success": True, "cert_id": cert_id, "message": "Certificate generation queued in background."}

@router.get("/", response_model=CertificateListResponse)
def list_certificates(page: int = 1, search: str = '', type: str = 'All', status: str = 'All', db: Session = Depends(get_db)):
    limit = 10
    offset = (page - 1) * limit
    
    query = db.query(Certificate)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Certificate.cert_id.ilike(search_pattern),
                Certificate.recipient_name.ilike(search_pattern),
                Certificate.recipient_email.ilike(search_pattern)
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
    db.commit()
    
    return {"success": True}

@router.get("/{cert_id}/html", response_model=dict)
def get_issued_certificate_html(cert_id: str, db: Session = Depends(get_db)):
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
