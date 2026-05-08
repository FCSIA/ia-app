# rag.py

import os
from typing import List, Tuple

from dotenv import load_dotenv
from openai import OpenAI

from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

# ---------- 1. Setup: env + clients ----------

load_dotenv()
client = OpenAI()  # uses OPENAI_API_KEY from .env

# Load an embedding model from sentence-transformers.
# This is a small, fast model good for semantic search.
embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


# ---------- 2. Load and chunk documents ----------

def load_text_files(folder: str) -> List[str]:
    """Read all .txt files in the folder and return their contents as a list of strings."""
    docs = []
    for name in os.listdir(folder):
        if name.endswith(".txt"):
            path = os.path.join(folder, name)
            with open(path, "r", encoding="utf-8") as f:
                docs.append(f.read())
    return docs


def chunk_text(text: str, max_chars: int = 500) -> List[str]:
    """
    Break a long string into smaller chunks of about max_chars characters.
    This keeps each piece manageable for retrieval.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        chunks.append(chunk)
        start = end
    return chunks


def build_corpus(folder: str) -> List[str]:
    """
    Load all docs from the folder and split them into chunks.
    Returns a list of chunk strings.
    """
    docs = load_text_files(folder)
    corpus_chunks = []
    for doc in docs:
        corpus_chunks.extend(chunk_text(doc))
    return corpus_chunks


# ---------- 3. Build the vector index with FAISS ----------

def build_faiss_index(chunks: List[str]) -> Tuple[faiss.IndexFlatIP, np.ndarray]:
    """
    Turn chunks into embeddings and store them in a FAISS index.
    Returns (index, embeddings_array).
    """
    # Convert text chunks to embeddings (vectors)
    embeddings = embedding_model.encode(
        chunks,
        convert_to_numpy=True,
        normalize_embeddings=True  # makes cosine similarity easier with inner product
    ).astype("float32")

    dim = embeddings.shape[1]  # size of each vector

    # IndexFlatIP = inner-product index (works like cosine when vectors are normalized)
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)  # store all embeddings in the index

    return index, embeddings


# ---------- 4. Retrieve relevant chunks for a question ----------

def retrieve_top_k(
    question: str,
    chunks: List[str],
    index: faiss.IndexFlatIP,
    k: int = 5
) -> List[str]:
    """
    Given a question, return the top-k most similar text chunks.
    """
    # Turn the question into an embedding
    q_vec = embedding_model.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True
    ).astype("float32")

    # Search the index
    scores, ids = index.search(q_vec, min(k, len(chunks)))
    top_chunks = [chunks[i] for i in ids[0]]
    return top_chunks


# ---------- 5. Ask OpenAI using retrieved context ----------

def ask_with_rag(question: str, chunks: List[str], index: faiss.IndexFlatIP) -> str:
    """
    Build a prompt that includes the most relevant chunks
    and send it to the OpenAI model.
    """
    top_chunks = retrieve_top_k(question, chunks, index, k=5)

    context_text = "\n\n---\n\n".join(top_chunks)

    prompt = f"""
You are a helpful tutor. Use ONLY the information in the context below to answer the question.

Context:
{context_text}

Question: {question}

If the context does not contain the answer, say you don't know based on the provided notes.
"""

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )

    return response.output_text


# ---------- 6. Main interactive loop ----------

def main():
    # 1) Build the corpus from ./data
    data_folder = os.path.join(os.path.dirname(__file__), "data")
    print(f"Loading documents from: {data_folder}")
    chunks = build_corpus(data_folder)
    print(f"Total chunks: {len(chunks)}")

    # 2) Build the FAISS index
    print("Building FAISS index...")
    index, _ = build_faiss_index(chunks)
    print("Index built.")

    # 3) Simple REPL: ask questions until user types 'quit'
    while True:
        question = input("\nAsk a question about your notes (or type 'quit' to exit):\n> ")
        if question.lower().strip() in {"quit", "exit"}:
            print("Goodbye!")
            break

        answer = ask_with_rag(question, chunks, index)
        print("\n--- Answer ---")
        print(answer)
        print("--------------")


if __name__ == "__main__":
    main()
