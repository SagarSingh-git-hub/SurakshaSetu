from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_admin_token
from models.models import CertificateTemplate
from schemas.schemas import TemplateCreate, TemplateUpdate, TemplateResponse
from typing import List

router = APIRouter()

@router.post("/", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    if template.is_default:
        db.query(CertificateTemplate).update({"is_default": False})
    
    db_template = CertificateTemplate(**template.model_dump())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/", response_model=dict)
def get_templates(db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    # Wrapping in dict to match legacy PHP response {"success": True, "templates": [...]}
    templates = db.query(CertificateTemplate).order_by(CertificateTemplate.is_default.desc(), CertificateTemplate.name.asc()).all()
    return {"success": True, "templates": templates}

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    template = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, template: TemplateUpdate, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    db_template = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    update_data = template.model_dump(exclude_unset=True)
    
    if update_data.get("is_default"):
        db.query(CertificateTemplate).update({"is_default": False})
        
    for key, value in update_data.items():
        setattr(db_template, key, value)
        
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), admin=Depends(verify_admin_token)):
    db_template = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(db_template)
    db.commit()
    return {"success": True, "message": "Template deleted"}
