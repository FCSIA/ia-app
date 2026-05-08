"""
MCP RAG server: exposes one tool `answer_from_notes`.

This wraps your RAG logic (like in 02_rag_basic) so an MCP client
can call it as a tool.
"""

import os
from typing import List, Tuple

# ---- MCP + OpenAI + RAG imports ----
from dotenv import load_dotenv
from openai import OpenAI

from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

from mcp.server import Server
from mcp.server.stdio import stdio_server

#from mcp.server.stdio import run_stdio_server

#from mcp.server.stdio import stdio_server

#from mcp.server import stdio  # stdio transport for MCP
from mcp import types         # MCP types for tools + content

# ---------- 1. Setup: environment, OpenAI, embedding model ----------

print("[startup] Loading environment variables from .env...")
load_dotenv()

print("[startup] Creating OpenAI client...")
client = OpenAI()  # reads OPENAI_API_KEY from environment

print("[startup] Loading sentence-transformers model (this can take a bit)...")
embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
print("[startup] Embedding model loaded.")

# ---------- 2. RAG helper functions (similar to rag.py) ----------

def load_text_files(folder: str) -> List[str]:
    """Read all .txt files in the folder and return their contents as a list of strings."""
    print(f"[rag] Loading .txt files from folder: {folder}")
    docs = []
    for name in os.listdir(folder):
        if name.endswith(".txt"):
            path = os.path.join(folder, name)
            print(f"[rag] Reading file: {path}")
            with open(path, "r", encoding="utf-8") as f:
                docs.append(f.read())
    print(f"[rag] Loaded {len(docs)} documents.")
    return docs


def chunk_text(text: str, max_chars: int = 500) -> List[str]:
    """
    Break a long string into smaller chunks of about max_chars characters.
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
    """
    docs = load_text_files(folder)
    corpus_chunks = []
    for i, doc in enumerate(docs):
        doc_chunks = chunk_text(doc)
        print(f"[rag] Document {i} split into {len(doc_chunks)} chunks.")
        corpus_chunks.extend(doc_chunks)
    print(f"[rag] Total chunks in corpus: {len(corpus_chunks)}")
    return corpus_chunks


def build_faiss_index(chunks: List[str]) -> Tuple[faiss.IndexFlatIP, np.ndarray]:
    """
    Turn chunks into embeddings and store them in a FAISS index.
    """
    print("[rag] Encoding chunks into embeddings...")
    embeddings = embedding_model.encode(
        chunks,
        convert_to_numpy=True,
        normalize_embeddings=True
    ).astype("float32")

    dim = embeddings.shape[1]
    print(f"[rag] Embeddings shape: {embeddings.shape} (dimension = {dim})")

    index = faiss.IndexFlatIP(dim)
    print("[rag] Adding embeddings to FAISS index...")
    index.add(embeddings)
    print(f"[rag] FAISS index now contains {index.ntotal} vectors.")

    return index, embeddings


def retrieve_top_k(
    question: str,
    chunks: List[str],
    index: faiss.IndexFlatIP,
    k: int = 5
) -> List[str]:
    """
    Given a question, return top-k most similar text chunks.
    """
    print(f"[rag] Retrieving top {k} chunks for question: {question!r}")
    q_vec = embedding_model.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True
    ).astype("float32")

    scores, ids = index.search(q_vec, min(k, len(chunks)))
    print(f"[rag] FAISS scores: {scores}")
    print(f"[rag] FAISS indices: {ids}")

    top_chunks = [chunks[i] for i in ids[0]]
    print(f"[rag] Retrieved {len(top_chunks)} chunks.")
    return top_chunks


def ask_with_rag(
    question: str,
    chunks: List[str],
    index: faiss.IndexFlatIP
) -> str:
    """
    Build a prompt that includes the most relevant chunks
    and send it to the OpenAI model.
    """
    print(f"[rag] ask_with_rag called with question: {question!r}")
    top_chunks = retrieve_top_k(question, chunks, index, k=5)

    context_text = "\n\n---\n\n".join(top_chunks)

    prompt = f"""
You are a helpful tutor. Use ONLY the information in the context below to answer the question.

Context:
{context_text}

Question: {question}

If the context does not contain the answer, say you don't know based on the provided notes.
"""

    print("[rag] Sending prompt to OpenAI model (gpt-4.1-mini)...")
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )
    answer_text = response.output_text
    print("[rag] Received answer from OpenAI.")
    return answer_text


# ---------- 3. Build RAG index once at server startup ----------

print("[startup] Building RAG index from ./data folder...")

DATA_FOLDER = os.path.join(os.path.dirname(__file__), "data")
all_chunks = build_corpus(DATA_FOLDER)
faiss_index, _ = build_faiss_index(all_chunks)

print("[startup] RAG index ready.")
print("[startup] Setting up MCP server...")

# ---------- 4. MCP server definition and tool exposure ----------

server = Server("rag-mcp-server")  # name visible to clients


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """
    Tell MCP clients what tools are available on this server.
    Here we expose a single tool: answer_from_notes.
    """
    print("[mcp] list_tools called by client.")
    return [
        types.Tool(
            name="answer_from_notes",
            description="Answer questions using the local notes RAG index.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The user question about the notes."
                    }
                },
                "required": ["question"]
            },
        )
    ]


@server.call_tool()
async def call_tool(
    name: str,
    arguments: dict
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """
    Handle a tool call from a client.
    We check the tool `name`, read its arguments, call our RAG,
    and return the answer as TextContent.
    """
    print(f"[mcp] call_tool called. name={name!r}, arguments={arguments!r}")

    if name == "answer_from_notes":
        # 1) Get question string from arguments
        question = arguments.get("question", "")
        print(f"[mcp] answer_from_notes question: {question!r}")

        if not question:
            print("[mcp] No question provided in arguments.")
            return [
                types.TextContent(
                    type="text",
                    text="Error: 'question' argument is required."
                )
            ]

        # 2) Call our RAG helper
        answer = ask_with_rag(question, all_chunks, faiss_index)

        # 3) Wrap result in TextContent
        print("[mcp] Returning RAG answer to client.")
        return [
            types.TextContent(
                type="text",
                text=answer
            )
        ]

    # If client asks for a tool that doesn't exist
    print(f"[mcp] Unknown tool requested: {name!r}")
    raise ValueError(f"Tool not found: {name}")


# ---------- 5. Main: run MCP over stdio ----------

# ---------- 5. Main: run MCP over stdio ----------

async def main() -> None:
    """
    Entry point for the MCP server. Uses stdio transport so tools like
    MCP Inspector or agents can run `python server.py` and talk to it.
    """
    print("[startup] Starting MCP stdio server. Waiting for client connections...")
    # stdio_server is an async context manager in this SDK version,
    # so we must use `async with` instead of just `await stdio_server(server)`.
    async with stdio_server(server):
        # Inside this block, the server is running and handling requests.
        # We just sleep forever (until the client closes or process is killed).
        import asyncio
        while True:
            await asyncio.sleep(3600)
    print("[shutdown] MCP stdio server stopped.")


if __name__ == "__main__":
    import asyncio

    print("[startup] Entering asyncio event loop...")
    asyncio.run(main())
