import arxiv
import fitz  # PyMuPDF
import urllib.request
import logging
from sqlalchemy.orm import Session
from models import Paper, Author, Category
from config import settings

logger = logging.getLogger(__name__)

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

def download_pdf(url: str) -> bytes:
    try:
        # arxiv urls might be http, replace to https
        url = url.replace("http://", "https://")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()
    except Exception as e:
        logger.error(f"Error downloading PDF from {url}: {e}")
        return None

def fetch_and_store_latest_papers(db: Session):
    for category_pattern in settings.arxiv_categories:
        logger.info(f"Fetching papers for category: {category_pattern}")
        client = arxiv.Client()
        search = arxiv.Search(
            query=f"cat:{category_pattern}",
            max_results=settings.max_papers_per_fetch,
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )
        
        try:
            results = list(client.results(search))
        except Exception as e:
            logger.error(f"Error fetching from arxiv: {e}")
            continue
            
        for r in results:
            entry_id_raw = r.entry_id
            # arxiv id is usually the last part of the entry url like http://arxiv.org/abs/2103.12345
            paper_id = entry_id_raw.split('/')[-1]
            
            # Check if paper already exists
            existing_paper = db.query(Paper).filter(Paper.id == paper_id).first()
            if existing_paper:
                continue
                
            logger.info(f"Processing new paper: {r.title}")
            
            pdf_url = r.pdf_url
            full_text = ""
            if pdf_url:
                pdf_bytes = download_pdf(pdf_url)
                if pdf_bytes:
                    full_text = extract_text_from_pdf_bytes(pdf_bytes)
            
            # create paper
            new_paper = Paper(
                id=paper_id,
                title=r.title,
                abstract=r.summary,
                full_text=full_text,
                published_date=r.published,
                pdf_url=pdf_url,
                entry_id=entry_id_raw
            )
            
            # handle authors
            for obj_author in r.authors:
                author_name = obj_author.name
                db_author = db.query(Author).filter(Author.name == author_name).first()
                if not db_author:
                    db_author = Author(name=author_name)
                    db.add(db_author)
                new_paper.authors.append(db_author)
                
            # handle categories
            for cat_name in r.categories:
                db_cat = db.query(Category).filter(Category.name == cat_name).first()
                if not db_cat:
                    db_cat = Category(name=cat_name)
                    db.add(db_cat)
                new_paper.categories.append(db_cat)
                
            db.add(new_paper)
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Error saving paper {paper_id}: {e}")
