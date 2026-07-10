import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os

def send_certificate_email(to_email: str, recipient_name: str, cert_type: str, cert_id: str, pdf_bytes: bytes = None):
    smtp_server = os.getenv("SMTP_HOST", "mail.smtp2go.com")
    smtp_port = int(os.getenv("SMTP_PORT", 2525))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not all([smtp_user, smtp_pass]):
        raise ValueError("SMTP is not configured.")
        
    msg = MIMEMultipart()
    msg['From'] = "no-reply@surakshasetu.org"
    msg['To'] = to_email
    msg['Subject'] = f"Your Certificate of {cert_type} is Ready!"
    
    html = f"""
    <html><body style='font-family:sans-serif; padding:20px;'>
    <h2 style='color:#16a34a;'>Congratulations {recipient_name}!</h2>
    <p>You have been awarded a <strong>{cert_type}</strong>.</p>
    <p>Your Certificate ID is: <strong>{cert_id}</strong></p>
    <p>You can view and download your official certificate by logging into the Suraksha Setu portal.</p>
    <hr style='border:none; border-top:1px solid #eee;'/>
    <p style='font-size:12px; color:#666;'>This is an automated message. Please do not reply.</p>
    </body></html>
    """
    
    msg.attach(MIMEText(html, 'html'))
    
    if pdf_bytes:
        part = MIMEApplication(pdf_bytes, Name=f"{cert_id}.pdf")
        part['Content-Disposition'] = f'attachment; filename="{cert_id}.pdf"'
        msg.attach(part)
        
    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        raise ValueError(f"Email delivery failed: {e}")
