import os
import boto3
from botocore.exceptions import ClientError

def upload_to_r2(file_data: bytes, object_key: str, mime_type: str = "application/pdf") -> str:
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket = os.getenv("R2_BUCKET")
    public_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
    
    if not all([account_id, access_key, secret_key, bucket]):
        raise ValueError("Cloud Storage is not configured.")
        
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )
    
    try:
        s3.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_data,
            ContentType=mime_type
        )
        return f"{public_url}/{object_key}"
    except ClientError as e:
        print(f"Error uploading to R2: {e}")
        return None
