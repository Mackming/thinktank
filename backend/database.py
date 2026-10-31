import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///thinktank.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DebateSession(Base):
    __tablename__ = "debate_sessions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    master_prompt = Column(Text, nullable=False)
    transcript = Column(Text, nullable=False)  # JSON string
    synthesis = Column(Text, nullable=True)    # JSON string

class Space(Base):
    __tablename__ = "spaces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)

class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, index=True)
    space_id = Column(Integer, index=True, nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    filename = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def save_session(master_prompt: str, transcript: str, synthesis: str) -> int:
    db = SessionLocal()
    try:
        new_session = DebateSession(
            master_prompt=master_prompt,
            transcript=transcript,
            synthesis=synthesis
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session.id
    finally:
        db.close()

def get_all_sessions():
    db = SessionLocal()
    try:
        return db.query(DebateSession).order_by(DebateSession.timestamp.desc()).all()
    finally:
        db.close()

def get_session(session_id: int):
    db = SessionLocal()
    try:
        return db.query(DebateSession).filter(DebateSession.id == session_id).first()
    finally:
        db.close()

def get_all_spaces():
    db = SessionLocal()
    try:
        return db.query(Space).all()
    finally:
        db.close()

def create_space(name: str, description: str, icon: str):
    db = SessionLocal()
    try:
        space = Space(name=name, description=description, icon=icon)
        db.add(space)
        print("DEBUG BACKEND: Committing to SQLite...")
        db.commit()
        db.refresh(space)
        print("DEBUG BACKEND: Successfully created space with ID:", space.id)
        return space
    except Exception as e:
        db.rollback()
        print(f"DEBUG BACKEND DB ERROR: {str(e)}")
        raise e
    finally:
        db.close()

def get_books_by_space(space_id: int):
    db = SessionLocal()
    try:
        return db.query(Book).filter(Book.space_id == space_id).all()
    finally:
        db.close()

def add_book(space_id: int, title: str, author: str, filename: str):
    db = SessionLocal()
    try:
        book = Book(space_id=space_id, title=title, author=author, filename=filename)
        db.add(book)
        db.commit()
        db.refresh(book)
        return book
    finally:
        db.close()

def delete_book_db(book_id: int):
    db = SessionLocal()
    try:
        book = db.query(Book).filter(Book.id == book_id).first()
        if book:
            db.delete(book)
            db.commit()
            return book
        return None
    finally:
        db.close()
