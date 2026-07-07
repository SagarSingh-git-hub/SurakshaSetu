import os
import json
import time
import hashlib
import hmac
import urllib.request
import urllib.error

def trigger_pusher_event(channel: str, event: str, data: dict):
    app_id = os.getenv("PUSHER_APP_ID")
    key = os.getenv("PUSHER_KEY")
    secret = os.getenv("PUSHER_SECRET")
    cluster = os.getenv("PUSHER_CLUSTER")
    
    if not all([app_id, key, secret, cluster]) or app_id == 'YOUR_APP_ID':
        return False
        
    payload = json.dumps({
        "name": event,
        "channels": [channel],
        "data": json.dumps(data)
    }).encode('utf-8')
    
    auth_timestamp = str(int(time.time()))
    auth_version = '1.0'
    body_md5 = hashlib.md5(payload).hexdigest()
    
    string_to_sign = f"POST\n/apps/{app_id}/events\nauth_key={key}&auth_timestamp={auth_timestamp}&auth_version={auth_version}&body_md5={body_md5}"
    auth_signature = hmac.new(secret.encode('utf-8'), string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    
    url = f"https://api-{cluster}.pusher.com/apps/{app_id}/events?body_md5={body_md5}&auth_version={auth_version}&auth_key={key}&auth_timestamp={auth_timestamp}&auth_signature={auth_signature}"
    
    try:
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=3) as response:
            return response.status == 200
    except Exception as e:
        print(f"Pusher error: {e}")
        return False
