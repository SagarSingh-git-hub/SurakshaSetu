import os
from sqlalchemy import create_engine
from models.models import Base
from core.database import engine

def init_db():
    print("Creating tables if they don't exist...")
    Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    init_db()
