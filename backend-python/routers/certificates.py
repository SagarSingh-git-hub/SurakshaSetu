import math
import hashlib
from fastapi import APIRouter, Depends, Request
from typing import Optional
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from datetime import datetime
import io
import csv
from core.database import get_db_connection
from core.security import verify_admin_token
from services.pdf_generator import generate_certificate_pdf
from services.storage import upload_to_r2
from services.email_service import send_certificate_email
from services.pusher_service import trigger_pusher_event

router = APIRouter()

class IssueCertificateRequest(BaseModel):
    recipient_type: str = 'Community Member'
    recipient_name: str
    recipient_email: str
    recipient_phone: Optional[str] = ''
    recipient_zone: Optional[str] = ''
    certificate_type: str
    issue_date: str
    citation: str
    issuing_authority: str
    co_signatory: Optional[str] = ''
    template_id: Optional[int] = 0
    send_email: Optional[int] = 0
    publish_to_feed: Optional[int] = 0

class UpdateCertificateRequest(BaseModel):
    cert_id: str
    action: str

@router.get("/get_members.php")
def get_members():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, email, phone, role FROM community_members ORDER BY name ASC")
            members = cursor.fetchall()
            return {"success": True, "data": members}
    finally:
        conn.close()

@router.get("/get_templates.php")
def get_templates():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM certificate_templates ORDER BY is_default DESC, name ASC")
            templates = cursor.fetchall()
            return {"success": True, "templates": templates}
    finally:
        conn.close()

@router.post("/issue_certificate.php")
def issue_certificate(req: IssueCertificateRequest, admin=Depends(verify_admin_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Generate unique ID
            date_obj = datetime.strptime(req.issue_date, "%Y-%m-%d")
            year = date_obj.strftime("%Y")
            prefix = 'SS-CERT'
            
            cursor.execute(f"SELECT COUNT(*) as cnt FROM certificates WHERE cert_id LIKE '{prefix}-{year}-%'")
            row = cursor.fetchone()
            seq = str(row['cnt'] + 1).zfill(4)
            cert_id = f"{prefix}-{year}-{seq}"
            
            # PDF Generation
            verify_url = f"https://surakshasetu.org/verify?id={cert_id}"
            pdf_bytes = generate_certificate_pdf(
                cert_id, req.recipient_name, req.certificate_type, req.citation,
                req.issue_date, req.issuing_authority, verify_url
            )
            
            # Upload to R2
            object_key = f"certificates/{year}/{cert_id}.pdf"
            pdf_url = upload_to_r2(pdf_bytes, object_key, "application/pdf")
            
            # Hash
            hash_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
            
            # Insert into DB
            sql = """
                INSERT INTO certificates 
                (cert_id, recipient_name, recipient_email, recipient_phone, recipient_zone, 
                 certificate_type, issue_date, citation, issuing_authority, co_signatory, 
                 template_id, recipient_type, pdf_url, hash_sha256) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            template_id_val = req.template_id if req.template_id and req.template_id > 0 else None
            
            cursor.execute(sql, (
                cert_id, req.recipient_name, req.recipient_email, req.recipient_phone, req.recipient_zone,
                req.certificate_type, req.issue_date, req.citation, req.issuing_authority, req.co_signatory,
                template_id_val, req.recipient_type, pdf_url, hash_sha256
            ))
            
            if template_id_val:
                cursor.execute("UPDATE certificate_templates SET usage_count = usage_count + 1, last_used = NOW() WHERE id = %s", (template_id_val,))
            
            # Insert Activity Log
            log_desc = f"Certificate #{cert_id} issued to {req.recipient_name} for {req.certificate_type}"
            cursor.execute("INSERT INTO activity_logs (event_type, reference_id, description, category, location) VALUES (%s, %s, %s, %s, %s)",
                           ('Certificate Issued', cert_id, log_desc, 'Certificate', req.recipient_zone))
            
            conn.commit()
            
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
                
            return {"success": True, "cert_id": cert_id, "pdf_url": pdf_url}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

@router.get("/list_certificates.php")
def list_certificates(page: int = 1, search: str = '', type: str = 'All', status: str = 'All'):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            limit = 10
            offset = (page - 1) * limit
            
            where_clauses = []
            params = []
            
            if search:
                where_clauses.append("(cert_id LIKE %s OR recipient_name LIKE %s OR recipient_email LIKE %s)")
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param])
                
            if type != 'All':
                where_clauses.append("certificate_type = %s")
                params.append(type)
                
            if status != 'All':
                where_clauses.append("status = %s")
                params.append(status)
                
            where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            # Stats
            cursor.execute("SELECT COUNT(*) as total FROM certificates")
            total = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as active FROM certificates WHERE status = 'Active'")
            active = cursor.fetchone()['active']
            
            cursor.execute("SELECT COUNT(*) as revoked FROM certificates WHERE status = 'Revoked'")
            revoked = cursor.fetchone()['revoked']
            
            cursor.execute("SELECT COUNT(*) as this_month FROM certificates WHERE MONTH(issue_date) = MONTH(CURRENT_DATE()) AND YEAR(issue_date) = YEAR(CURRENT_DATE())")
            this_month = cursor.fetchone()['this_month']
            
            # Count for pagination
            cursor.execute(f"SELECT COUNT(*) as filtered_total FROM certificates {where_str}", tuple(params))
            filtered_total = cursor.fetchone()['filtered_total']
            
            # Data
            query = f"SELECT * FROM certificates {where_str} ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            cursor.execute(query, tuple(params))
            data = cursor.fetchall()
            
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
    finally:
        conn.close()

@router.post("/update_certificate.php")
def update_certificate(req: UpdateCertificateRequest, admin=Depends(verify_admin_token)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            new_status = 'Revoked' if req.action == 'revoke' else 'Active'
            cursor.execute("UPDATE certificates SET status = %s WHERE cert_id = %s", (new_status, req.cert_id))
            conn.commit()
            return {"success": True}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

@router.get("/get_issued_certificate.php")
def get_issued_certificate(id: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM certificates WHERE cert_id = %s", (id,))
            cert = cursor.fetchone()
            if not cert:
                return {"success": False, "error": "Not found"}
                
            cursor.execute("SELECT html_content, css_content FROM certificate_templates WHERE id = %s", (cert['template_id'],))
            tmpl = cursor.fetchone()
            
            # Fallback simple HTML if template doesn't have html_content
            html = tmpl['html_content'] if tmpl and tmpl.get('html_content') else f"<h1>Certificate {cert['cert_id']}</h1><p>Awarded to {cert['recipient_name']}</p>"
            
            html = html.replace('{{NAME}}', cert['recipient_name'])
            html = html.replace('{{AWARD_TYPE}}', cert['certificate_type'])
            html = html.replace('{{DATE}}', str(cert['issue_date']))
            html = html.replace('{{ISSUER}}', cert['issuing_authority'])
            html = html.replace('{{CERTIFICATE_ID}}', cert['cert_id'])
            html = html.replace('{{CITATION}}', cert['citation'])
            
            if tmpl and tmpl.get('css_content'):
                html = f"<style>{tmpl['css_content']}</style>{html}"
                
            return {"success": True, "html_content": html}
    finally:
        conn.close()
