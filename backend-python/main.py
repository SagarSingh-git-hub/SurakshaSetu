import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env from parent dir .env if exists, or local
load_dotenv(dotenv_path="../backend/.env")

from routers import certificates

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
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )

app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["certificates"])

@app.get("/")
def read_root():
    return {"success": True, "message": "SurakshaSetu Certificate API is running"}
