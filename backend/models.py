from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base
import datetime

paper_author_association = Table(
    'paper_author',
    Base.metadata,
    Column('paper_id', String, ForeignKey('papers.id')),
    Column('author_id', Integer, ForeignKey('authors.id'))
)

paper_category_association = Table(
    'paper_category',
    Base.metadata,
    Column('paper_id', String, ForeignKey('papers.id')),
    Column('category_id', Integer, ForeignKey('categories.id'))
)

class Paper(Base):
    __tablename__ = "papers"

    id = Column(String, primary_key=True, index=True) # ArXiv ID
    title = Column(String, index=True)
    abstract = Column(Text)
    full_text = Column(Text, nullable=True) # Extracted from PDF
    published_date = Column(DateTime, index=True)
    pdf_url = Column(String)
    entry_id = Column(String) # the arxiv entry url
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    authors = relationship("Author", secondary=paper_author_association, back_populates="papers")
    categories = relationship("Category", secondary=paper_category_association, back_populates="papers")

class Author(Base):
    __tablename__ = "authors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    papers = relationship("Paper", secondary=paper_author_association, back_populates="authors")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    papers = relationship("Paper", secondary=paper_category_association, back_populates="categories")
