import os
import uuid
import datetime
import io
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from cryptography import x509

from pyhanko.sign import signers
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.writer import copy_into_new_writer

from core.database import get_db_connection

def generate_key_pair():
    """Generates an RSA private key and a self-signed X.509 certificate."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Uttar Pradesh"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"Agra"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"SurakshaSetu"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"SurakshaSetu Certificate Authority"),
    ])

    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        # Valid for 10 years
        datetime.datetime.utcnow() + datetime.timedelta(days=3650)
    ).add_extension(
        x509.SubjectAlternativeName([x509.DNSName(u"surakshasetu.org")]),
        critical=False,
    ).sign(private_key, hashes.SHA256())

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
    
    return private_pem, cert_pem

def get_or_create_active_key():
    """Fetches the active digital signature key from the database, or creates one if none exists."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT key_version, private_key, public_key FROM digital_signature_keys WHERE is_active = 1 LIMIT 1")
            row = cursor.fetchone()
            
            if row:
                return row['key_version'], row['private_key'], row['public_key']
                
            # Create a new key pair
            private_pem, cert_pem = generate_key_pair()
            key_version = f"v1-{uuid.uuid4().hex[:8]}"
            
            cursor.execute(
                "INSERT INTO digital_signature_keys (key_version, private_key, public_key) VALUES (%s, %s, %s)",
                (key_version, private_pem, cert_pem)
            )
            conn.commit()
            
            return key_version, private_pem, cert_pem
    finally:
        conn.close()

def sign_pdf(pdf_bytes: bytes) -> tuple[bytes, str]:
    """Signs a PDF using the active private key and returns the signed PDF bytes and key version."""
    key_version, private_pem, cert_pem = get_or_create_active_key()
    
    # pyHanko requires the signer to be initialized with bytes
    signer = signers.SimpleSigner.load_pem_private_key(
        private_pem.encode('utf-8'),
        cert_pem.encode('utf-8')
    )
    
    input_stream = io.BytesIO(pdf_bytes)
    output_stream = io.BytesIO()
    
    reader = PdfFileReader(input_stream)
    # We create a new writer from the reader
    writer = copy_into_new_writer(reader)
    
    # We perform the actual signature
    signers.sign_pdf(
        writer,
        signers.PdfSignatureMetadata(field_name='Signature1'),
        signer=signer,
        out_stream=output_stream
    )
    
    signed_pdf_bytes = output_stream.getvalue()
    return signed_pdf_bytes, key_version
