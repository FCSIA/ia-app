# ingest_regulations.py

import os
from pathlib import Path
from typing import List, Dict

from pypdf import PdfReader


DATA_DIR = Path("data/regulations")


def load_pdf_text(path: Path) -> str:
    """
    Load all text from a PDF file into a single string.
    Very simple for now; can be improved later.
    """
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def load_all_regulation_docs() -> List[Dict]:
    """
    Return a list of dicts: {file_name, text}.
    Later we'll add metadata from inventory.csv and chunking.
    """
    docs: List[Dict] = []

    for file in DATA_DIR.glob("*"):
        if file.suffix.lower() == ".pdf":
            text = load_pdf_text(file)
            docs.append(
                {
                    "file_name": file.name,
                    "text": text,
                }
            )

    return docs


if __name__ == "__main__":
    docs = load_all_regulation_docs()
    print(f"Loaded {len(docs)} documents.")
    for d in docs:
        print(f"- {d['file_name']}: {len(d['text'])} characters")
