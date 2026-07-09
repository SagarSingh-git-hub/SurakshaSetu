from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db
from models.models import Certificate, VerificationLog, CertificateTemplate, CertificateHash
from schemas.schemas import VerifyResponse
from services.signature_service import verify_signature

router = APIRouter()

@router.get("/{identifier}", response_model=dict)
def verify_certificate(identifier: str, request: Request, db: Session = Depends(get_db)):
    # identifier could be cert_id, hash, or verification_token
    cert = db.query(Certificate).filter(
        (Certificate.cert_id == identifier) | 
        (Certificate.hash_sha256 == identifier) |
        (Certificate.verification_token == identifier)
    ).first()
    
    ip_address = request.client.host if request.client else "Unknown"
    
    if not cert:
        log = VerificationLog(cert_id=identifier, ip_address=ip_address, status='Forged')
        db.add(log)
        db.commit()
        return {"success": False, "valid": False, "error": "Certificate not found or forged."}
        
    if cert.status == 'Revoked':
        log = VerificationLog(cert_id=cert.cert_id, ip_address=ip_address, status='Revoked')
        db.add(log)
        db.commit()
        return {
            "success": True, 
            "valid": False,
            "status": "Revoked",
            "error": "This certificate has been revoked.",
            "data": {
                "recipient_name": cert.recipient_name,
                "issue_date": cert.issue_date.strftime("%Y-%m-%d"),
                "certificate_type": cert.certificate_type
            }
        }
        
    if cert.status == 'Expired':
        log = VerificationLog(cert_id=cert.cert_id, ip_address=ip_address, status='Expired')
        db.add(log)
        db.commit()
        return {"success": True, "valid": False, "status": "Expired", "error": "Certificate has expired."}

    # Check signature integrity
    cert_hash = db.query(CertificateHash).filter(CertificateHash.cert_id == cert.cert_id).first()
    if not cert_hash or cert_hash.hash_sha256 != cert.hash_sha256:
        log = VerificationLog(cert_id=cert.cert_id, ip_address=ip_address, status='Forged')
        db.add(log)
        db.commit()
        return {"success": False, "valid": False, "status": "Forged", "error": "Data integrity check failed. Certificate may be forged."}

    # Valid
    log = VerificationLog(cert_id=cert.cert_id, ip_address=ip_address, status='Valid')
    db.add(log)
    db.commit()
    
    return {
        "success": True,
        "valid": True,
        "status": "Valid",
        "data": {
            "cert_id": cert.cert_id,
            "recipient_name": cert.recipient_name,
            "certificate_type": cert.certificate_type,
            "issue_date": cert.issue_date.strftime("%Y-%m-%d"),
            "issuing_authority": cert.issuing_authority,
            "citation": cert.citation,
            "pdf_url": cert.pdf_url,
            "qr_code_url": cert.qr_code_url,
            "key_version": cert.signature_key_version,
            "hash": cert.hash_sha256
        }
    }

@router.get("/{identifier}/html", response_model=dict)
def get_verified_certificate_html(identifier: str, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(
        (Certificate.cert_id == identifier) | 
        (Certificate.hash_sha256 == identifier) |
        (Certificate.verification_token == identifier)
    ).first()
    
    if not cert or cert.status not in ['Active', 'Issued', 'Delivered']:
        return {"success": False, "error": "Not found or invalid"}
        
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

