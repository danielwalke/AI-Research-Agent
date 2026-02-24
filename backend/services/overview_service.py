"""
Research Overview Service
Clusters papers by category, batches abstracts within token budget,
and orchestrates LLM calls to produce a coherent markdown narrative.
"""
import logging
import tiktoken
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Tuple, Optional

from sqlalchemy.orm import Session
from openai import AsyncOpenAI

from sqlalchemy import or_
from models import Paper, Author, Category
from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token counting
# ---------------------------------------------------------------------------
# Use cl100k_base encoding (GPT-4/3.5 tokenizer) as a reasonable approximation
# for any model. It's close enough for budget enforcement.
_encoding = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """Estimate token count for a string."""
    return len(_encoding.encode(text))


# ---------------------------------------------------------------------------
# Context window discovery (cached)
# ---------------------------------------------------------------------------
_context_window_cache: Dict[str, int] = {}


async def get_context_window(client: AsyncOpenAI, model: str) -> int:
    """Fetch the model's context window from OpenRouter and cache it."""
    if model in _context_window_cache:
        return _context_window_cache[model]

    try:
        import httpx
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            for m in data.get("data", []):
                if m.get("id") == model:
                    ctx = m.get("context_length", settings.overview_context_window)
                    _context_window_cache[model] = ctx
                    logger.info(f"Fetched context window for {model}: {ctx}")
                    return ctx
    except Exception as e:
        logger.warning(f"Could not fetch context window from OpenRouter: {e}")

    # Fallback
    fallback = settings.overview_context_window
    _context_window_cache[model] = fallback
    logger.info(f"Using fallback context window for {model}: {fallback}")
    return fallback


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def cluster_papers_by_category(papers: List[Paper]) -> Dict[str, List[Paper]]:
    """Group papers by their primary (first) ArXiv category."""
    clusters: Dict[str, List[Paper]] = defaultdict(list)
    for paper in papers:
        if paper.categories:
            primary_cat = paper.categories[0].name
        else:
            primary_cat = "Uncategorized"
        clusters[primary_cat].append(paper)

    # Sort clusters by size descending so the biggest themes come first
    sorted_clusters = dict(
        sorted(clusters.items(), key=lambda item: len(item[1]), reverse=True)
    )
    return sorted_clusters


# ---------------------------------------------------------------------------
# Batching within token budget
# ---------------------------------------------------------------------------

CATEGORY_LABELS = {
    "cs.AI": "Artificial Intelligence",
    "cs.LG": "Machine Learning",
    "cs.CL": "Computation & Language (NLP)",
    "cs.CV": "Computer Vision",
    "cs.CR": "Cryptography & Security",
    "cs.DB": "Databases",
    "cs.DC": "Distributed Computing",
    "cs.DS": "Data Structures & Algorithms",
    "cs.HC": "Human-Computer Interaction",
    "cs.IR": "Information Retrieval",
    "cs.IT": "Information Theory",
    "cs.MA": "Multiagent Systems",
    "cs.NE": "Neural & Evolutionary Computing",
    "cs.NI": "Networking & Internet Architecture",
    "cs.PL": "Programming Languages",
    "cs.RO": "Robotics",
    "cs.SE": "Software Engineering",
    "cs.SI": "Social & Information Networks",
    "stat.ML": "Machine Learning (Statistics)",
    "stat.ME": "Methodology (Statistics)",
    "stat.TH": "Theory (Statistics)",
    "q-bio.QM": "Quantitative Methods (Biology)",
    "q-bio.BM": "Biomolecules",
    "q-bio.GN": "Genomics",
    "q-bio.NC": "Neurons & Cognition",
}


def _friendly_category(cat_id: str) -> str:
    return CATEGORY_LABELS.get(cat_id, cat_id)


def format_paper_for_prompt(paper: Paper) -> str:
    """Format a single paper's info for inclusion in a prompt."""
    authors = ", ".join(a.name for a in paper.authors[:5])
    if len(paper.authors) > 5:
        authors += " et al."
    date_str = paper.published_date.strftime("%Y-%m-%d") if paper.published_date else "Unknown"
    return f"### {paper.title}\n**Authors:** {authors} | **Date:** {date_str}\n\n{paper.abstract}\n"


def batch_papers_by_budget(
    papers: List[Paper],
    max_tokens: int,
) -> List[List[Paper]]:
    """
    Split a list of papers into batches such that the concatenated abstracts
    in each batch fit within max_tokens.
    """
    batches: List[List[Paper]] = []
    current_batch: List[Paper] = []
    current_tokens = 0

    for paper in papers:
        paper_text = format_paper_for_prompt(paper)
        paper_tokens = count_tokens(paper_text)

        if current_tokens + paper_tokens > max_tokens and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_tokens = 0

        current_batch.append(paper)
        current_tokens += paper_tokens

    if current_batch:
        batches.append(current_batch)

    return batches


# ---------------------------------------------------------------------------
# LLM prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_CLUSTER = """You are a research analyst writing a weekly research digest newsletter. 
Your task is to synthesize the provided paper abstracts into a coherent, engaging narrative section.

Guidelines:
- Write in clear, flowing prose — not a list of summaries.
- Highlight key themes, novel methods, and connections between papers.
- Group related work together within your narrative.
- Use paper titles naturally in the text (bold them).
- Note any emerging trends or paradigm shifts.
- Keep the tone professional but accessible to a broad technical audience.
- Write 2-4 paragraphs per section depending on the number of papers.
- Do NOT add a section heading — one will be added for you.
"""

SYSTEM_PROMPT_SYNTHESIS = """You are a research analyst writing the executive summary for a weekly research digest.
You will receive multiple section summaries, each covering a research category.

Write a concise executive overview (2-3 paragraphs) that:
- Captures the overarching themes across all categories.
- Highlights the most impactful or novel work.
- Notes cross-cutting trends or connections between fields.
- Uses an engaging, newsletter-style tone.
"""


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

async def generate_overview(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    search: Optional[str] = None,
    category: Optional[str] = None,
) -> Dict:
    """
    Generate a comprehensive markdown narrative overview of papers matching
    the given filters (date range, search, category).
    
    Returns dict with keys: markdown, paper_count, cluster_count
    """
    # 1. Query papers with all filters
    query = db.query(Paper)
    
    if start_date:
        query = query.filter(Paper.published_date >= start_date)
    if end_date:
        query = query.filter(Paper.published_date < end_date)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Paper.title.ilike(search_term),
                Paper.abstract.ilike(search_term),
            )
        )
    
    if category:
        query = query.filter(Paper.categories.any(Category.name == category))
    
    papers = query.order_by(Paper.published_date.desc()).all()

    if not papers:
        return {
            "markdown": "# Research Overview\n\nNo papers found in the selected time range.",
            "paper_count": 0,
            "cluster_count": 0,
        }

    # 2. Cluster
    clusters = cluster_papers_by_category(papers)
    logger.info(f"Found {len(papers)} papers in {len(clusters)} categories")

    # 3. Determine token budget
    model = settings.overview_model
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )
    context_window = await get_context_window(client, model)

    system_prompt_reserve = 300  # tokens for system prompt
    response_reserve = int(context_window * 0.10)  # 10% for response
    max_abstract_tokens = int(
        context_window * settings.overview_budget_ratio
        - system_prompt_reserve
        - response_reserve
    )
    logger.info(
        f"Token budget: context_window={context_window}, "
        f"max_abstract_tokens={max_abstract_tokens}"
    )

    # 4. Generate per-cluster narratives
    section_narratives: List[Tuple[str, str, int]] = []  # (category, narrative, paper_count)

    for cat_id, cat_papers in clusters.items():
        cat_label = _friendly_category(cat_id)
        batches = batch_papers_by_budget(cat_papers, max_abstract_tokens)
        logger.info(
            f"Category '{cat_label}': {len(cat_papers)} papers, {len(batches)} batch(es)"
        )

        batch_narratives = []
        for batch in batches:
            abstracts_text = "\n---\n".join(
                format_paper_for_prompt(p) for p in batch
            )
            user_prompt = (
                f"Here are {len(batch)} recent papers in **{cat_label}** ({cat_id}):\n\n"
                f"{abstracts_text}\n\n"
                f"Synthesize these into a cohesive narrative section."
            )

            try:
                completion = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT_CLUSTER},
                        {"role": "user", "content": user_prompt},
                    ],
                    timeout=120,
                )
                narrative = completion.choices[0].message.content
                batch_narratives.append(narrative)
            except Exception as e:
                logger.error(f"LLM call failed for {cat_label}: {e}")
                batch_narratives.append(
                    f"*Summary could not be generated for this batch ({e}).*"
                )

        # If multiple batches, merge them
        if len(batch_narratives) == 1:
            final_narrative = batch_narratives[0]
        else:
            merge_prompt = (
                "Merge the following partial summaries into one coherent section:\n\n"
                + "\n\n---\n\n".join(batch_narratives)
            )
            try:
                completion = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT_CLUSTER},
                        {"role": "user", "content": merge_prompt},
                    ],
                    timeout=120,
                )
                final_narrative = completion.choices[0].message.content
            except Exception as e:
                logger.error(f"Merge LLM call failed for {cat_label}: {e}")
                final_narrative = "\n\n".join(batch_narratives)

        section_narratives.append((cat_label, final_narrative, len(cat_papers)))

    # 5. Generate executive summary
    executive_summary = ""
    if len(section_narratives) > 1:
        sections_overview = "\n\n".join(
            f"**{label}** ({count} papers):\n{narrative[:500]}..."
            for label, narrative, count in section_narratives
        )
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_SYNTHESIS},
                    {
                        "role": "user",
                        "content": f"Here are the section summaries:\n\n{sections_overview}",
                    },
                ],
                timeout=120,
            )
            executive_summary = completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Executive summary LLM call failed: {e}")

    # 6. Assemble final markdown
    start_str = start_date.strftime("%B %d, %Y")
    end_str = end_date.strftime("%B %d, %Y")

    md_parts = [
        f"# 📡 Research Overview",
        f"**{start_str} — {end_str}** · {len(papers)} papers across {len(clusters)} categories\n",
    ]

    if executive_summary:
        md_parts.append("## Executive Summary\n")
        md_parts.append(executive_summary + "\n")

    md_parts.append("---\n")

    # Table of contents
    md_parts.append("## Table of Contents\n")
    for i, (label, _, count) in enumerate(section_narratives, 1):
        anchor = label.lower().replace(" ", "-").replace("(", "").replace(")", "")
        md_parts.append(f"{i}. [{label}](#{anchor}) ({count} papers)")
    md_parts.append("\n---\n")

    # Sections
    for label, narrative, count in section_narratives:
        md_parts.append(f"## {label}")
        md_parts.append(f"*{count} papers*\n")
        md_parts.append(narrative)
        md_parts.append("\n---\n")

    markdown = "\n".join(md_parts)

    return {
        "markdown": markdown,
        "paper_count": len(papers),
        "cluster_count": len(clusters),
    }
