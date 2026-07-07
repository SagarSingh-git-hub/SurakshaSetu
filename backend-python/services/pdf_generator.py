from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, letter
import qrcode

def generate_certificate_pdf(cert_id: str, recipient_name: str, cert_type: str, citation: str, date: str, issuer: str, verify_url: str) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    width, height = landscape(letter)
    
    c.setFillColorRGB(0.95, 0.98, 0.95)
    c.rect(0, 0, width, height, fill=1)
    
    c.setFillColorRGB(0.1, 0.3, 0.1)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2, height - 100, "C E R T I F I C A T E")
    
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 140, "T H I S C E R T I F I C A T E I S P R O U D L Y P R E S E N T E D T O")
    
    c.setFont("Helvetica-Oblique", 28)
    c.drawCentredString(width / 2, height - 200, recipient_name)
    
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 240, f"For outstanding contribution in {cert_type}")
    
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 280, citation)
    
    c.setFont("Helvetica", 10)
    c.drawString(100, 100, f"Date: {date}")
    c.drawString(100, 80, f"ID: {cert_id}")
    
    c.drawString(width - 250, 100, f"Issuer: {issuer}")
    
    qr = qrcode.QRCode(version=1, box_size=3, border=1)
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    qr_buffer = BytesIO()
    img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(qr_buffer), width / 2 - 45, 50, 90, 90)
    
    c.showPage()
    c.save()
    
    return buffer.getvalue()
