from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime

# --- Templates ---
class TemplateCreate(BaseModel):
    name: str
    award_type: Optional[str] = None
    bg_gradient: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    icon_class: Optional[str] = None
    html_content: Optional[str] = None
    css_content: Optional[str] = None
    is_custom_html: Optional[bool] = False
    is_default: Optional[bool] = False

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    award_type: Optional[str] = None
    bg_gradient: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    icon_class: Optional[str] = None
    html_content: Optional[str] = None
    css_content: Optional[str] = None
    is_custom_html: Optional[bool] = None
    is_default: Optional[bool] = None

class TemplateResponse(BaseModel):
    id: int
    name: str
    award_type: Optional[str]
    bg_gradient: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    icon_class: Optional[str]
    html_content: Optional[str]
    css_content: Optional[str]
    is_custom_html: bool
    is_default: bool
    usage_count: int
    last_used: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Certificates ---
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

class CertificateResponse(BaseModel):
    id: int
    cert_id: str
    recipient_name: str
    recipient_email: str
    recipient_phone: Optional[str]
    recipient_zone: Optional[str]
    certificate_type: str
    issue_date: date
    citation: str
    issuing_authority: str
    co_signatory: Optional[str]
    status: str
    template_id: Optional[int]
    pdf_url: Optional[str]
    qr_code_url: Optional[str]
    hash_sha256: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class CertificateListResponse(BaseModel):
    success: bool
    data: List[CertificateResponse]
    stats: Dict[str, Any]
    pagination: Dict[str, Any]

# --- Verify ---
class VerifyResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# --- Settings ---
class SettingUpdate(BaseModel):
    key: str
    value: str
