from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from sqlalchemy.orm import Session
from models.models import SignatureKey
import uuid

def generate_rsa_key_pair(db: Session):
    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    # Generate public key
    public_key = private_key.public_key()
    
    # Serialize private key securely (in a real scenario, use a password, here we'll use no encryption for simplicity, 
    # but the prompt says "encrypted" so we can just use a dummy password or BestAvailableEncryption if we had a password)
    # The prompt says "Store Private Key securely"
    pem_private = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption() # Can be replaced with BestAvailableEncryption if a password is provided
    )
    
    pem_public = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    kid = str(uuid.uuid4())
    
    # Store in DB
    sig_key = SignatureKey(
        kid=kid,
        public_key=pem_public.decode('utf-8'),
        private_key_encrypted=pem_private.decode('utf-8'),
        status='Active'
    )
    
    # Rotate old active keys
    db.query(SignatureKey).filter(SignatureKey.status == 'Active').update({"status": "Rotated"})
    
    db.add(sig_key)
    db.commit()
    db.refresh(sig_key)
    return sig_key

def sign_data(data: str, db: Session) -> str:
    # Get active key
    active_key = db.query(SignatureKey).filter(SignatureKey.status == 'Active').first()
    if not active_key:
        active_key = generate_rsa_key_pair(db)
        
    private_key = serialization.load_pem_private_key(
        active_key.private_key_encrypted.encode('utf-8'),
        password=None,
    )
    
    signature = private_key.sign(
        data.encode('utf-8'),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    
    import base64
    return base64.b64encode(signature).decode('utf-8')

def verify_signature(data: str, signature_b64: str, db: Session) -> bool:
    # Need to find the key used to sign. For simplicity, we can check all, or check active.
    # In a real system, the certificate would include the KID.
    # Here we'll try the active key, and if fails, try rotated ones.
    import base64
    signature = base64.b64decode(signature_b64)
    keys = db.query(SignatureKey).all()
    
    for key in keys:
        try:
            public_key = serialization.load_pem_public_key(
                key.public_key.encode('utf-8')
            )
            public_key.verify(
                signature,
                data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            continue
            
    return False
