import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env from parent dir .env if exists, or local
load_dotenv(dotenv_path="../backend/.env")

from routers import certificates, templates, verify, settings, certificate_security, email, certificate_settings, audit

app = FastAPI(title="SurakshaSetu Certificate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handler to match PHP legacy API style {"success": false, "error": "msg"}
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )

app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["certificates"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])
app.include_router(verify.router, prefix="/api/v1/verify", tags=["verify"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(certificate_security.router, prefix="/api/v1/certificate/security", tags=["certificate_security"])
app.include_router(email.router, prefix="/api/v1/email", tags=["email"])
app.include_router(certificate_settings.router, prefix="/api/v1/certificate/settings", tags=["certificate_settings"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])

@app.get("/")
def read_root():
    return {"success": True, "message": "SurakshaSetu Certificate API is running"}
