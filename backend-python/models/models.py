from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.sql import func
from core.database import Base

class CertificateTemplate(Base):
    __tablename__ = "certificate_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    award_type = Column(String(100))
    bg_gradient = Column(String(100), default='linear-gradient(135deg, rgba(251,191,36,0.08), rgba(34,197,94,0.06))')
    primary_color = Column(String(20), default='var(--gold)')
    secondary_color = Column(String(20), default='var(--t3)')
    icon_class = Column(String(50), default='ti ti-award')
    html_content = Column(Text)
    css_content = Column(Text)
    is_custom_html = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    cert_id = Column(String(50), unique=True, nullable=False, index=True)
    recipient_type = Column(String(50), default='Community Member')
    recipient_name = Column(String(100), nullable=False)
    recipient_email = Column(String(150), nullable=False)
    recipient_phone = Column(String(20))
    recipient_zone = Column(String(100))
    certificate_type = Column(String(100), nullable=False, index=True)
    issue_date = Column(Date, nullable=False, index=True)
    citation = Column(Text, nullable=False)
    issuing_authority = Column(String(100), nullable=False)
    co_signatory = Column(String(100))
    status = Column(String(50), default='Active', index=True)
    template_id = Column(Integer, ForeignKey("certificate_templates.id"))
    pdf_url = Column(String(500))
    qr_code_url = Column(String(500))
    hash_sha256 = Column(String(64))
    signature_key_version = Column(String(50), nullable=True)
    verification_token = Column(String(100), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=func.now())

class CertificateHash(Base):
    __tablename__ = "certificate_hashes"

    id = Column(Integer, primary_key=True, index=True)
    cert_id = Column(String(50), unique=True, nullable=False, index=True)
    hash_sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=func.now())

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)
    reference_id = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50))
    location = Column(String(255))
    created_at = Column(DateTime, default=func.now())

class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, nullable=False, index=True)
    job_type = Column(String(50), nullable=False) # e.g., 'issue_certificate'
    payload = Column(Text, nullable=True) # JSON payload
    status = Column(String(20), default='Pending') # Pending, Processing, Completed, Failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    cert_id = Column(String(50), nullable=False, index=True)
    ip_address = Column(String(45))
    verified_at = Column(DateTime, default=func.now())
    status = Column(String(50)) # Valid, Invalid, Revoked, Expired

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    cert_id = Column(String(50), nullable=False)
    recipient_email = Column(String(150), nullable=False)
    status = Column(String(50)) # Sent, Failed
    error_message = Column(Text)
    sent_at = Column(DateTime, default=func.now())

class SignatureKey(Base):
    __tablename__ = "signature_keys"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(20), default='v1.0')
    public_key = Column(Text, nullable=False)
    private_key_path = Column(String(500), nullable=True)
    private_key_encrypted = Column(Text, nullable=True) # Keeping for backward compat / alternative storage
    fingerprint = Column(String(100), nullable=True)
    algorithm = Column(String(50), default='RSA-2048')
    status = Column(String(20), default='Active') # Active, Rotated
    created_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=True)
    rotated_at = Column(DateTime, nullable=True)

class CertificateSecurityLog(Base):
    __tablename__ = "certificate_security_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    performed_by = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

class SystemCertificateSetting(Base):
    __tablename__ = "system_certificate_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, nullable=False)
    setting_value = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class LoginSession(Base):
    __tablename__ = "login_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False)
    token = Column(String(255), unique=True, index=True)
    ip_address = Column(String(45), nullable=False)
    device = Column(String(100))
    browser = Column(String(100))
    location = Column(String(100))
    login_time = Column(DateTime, default=func.now())
    last_activity = Column(DateTime, default=func.now(), onupdate=func.now())
    status = Column(String(50), default='Active')

class CertificateGenerationSetting(Base):
    __tablename__ = "certificate_generation_settings"

    id = Column(Integer, primary_key=True, index=True)
    qr_settings = Column(Text, nullable=True)
    pdf_settings = Column(Text, nullable=True)
    branding_settings = Column(Text, nullable=True)
    output_preferences = Column(Text, nullable=True)
    performance_settings = Column(Text, nullable=True)
    storage_settings = Column(Text, nullable=True)
    advanced_settings = Column(Text, nullable=True)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class EmailIntegrationSetting(Base):
    __tablename__ = "email_integration_settings"

    id = Column(Integer, primary_key=True, index=True)
    smtp_config = Column(Text, nullable=True)
    template_settings = Column(Text, nullable=True)
    delivery_settings = Column(Text, nullable=True)
    automation_settings = Column(Text, nullable=True)
    branding_settings = Column(Text, nullable=True)
    updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class CertificateAuditLog(Base):
    __tablename__ = "certificate_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    cert_id = Column(String(50), ForeignKey("certificates.cert_id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False) # Draft, Generated, Signed, Uploaded, Issued, Delivered, Revoked, Verified, Archived
    administrator = Column(String(100), default='System')
    ip_address = Column(String(45), nullable=True)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=func.now())

class EmailAuditLog(Base):
    __tablename__ = "email_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    administrator = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=func.now())
