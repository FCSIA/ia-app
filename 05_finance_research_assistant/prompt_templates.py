# prompt_templates.py

"""
Prompt templates for the Finance Research Assistant.

Each function returns a prompt string that the main app will send
to the LLM, with placeholders filled in by Python.
"""

def explain_concept_prompt(concept: str) -> str:
    """
    Explain a single financial concept in a structured way.
    """
    return f"""
You are a senior investment banking trainer.
Explain the following financial concept to a smart junior analyst.

Concept: {concept}

Write the answer in this structure:

1. One-sentence overview
2. Detailed definition
3. Key components or mechanics
4. Why it matters in practice
5. Simple numeric example (if relevant)
6. Common pitfalls or misunderstandings

Use clear, precise language but keep it understandable for someone
with 1–2 years of finance experience.
"""


def compare_concepts_prompt(concept_a: str, concept_b: str) -> str:
    """
    Compare two related financial concepts.
    """
    return f"""
You are a senior investment banking trainer.
Compare the following two financial concepts:

A: {concept_a}
B: {concept_b}

Write the answer in this structure:

1. Brief definition of A
2. Brief definition of B
3. Key similarities
4. Key differences
5. When to use A vs B in practice
6. Common confusions and how to avoid them

Be specific and concrete. Assume the reader knows basic finance
but is not an expert in these products yet.
"""


def risk_summary_prompt(concept_or_instrument: str) -> str:
    """
    Summarize the main risks of a product, strategy, or concept.
    """
    return f"""
You are a risk manager at an investment bank.
Summarize the key risks of the following product, strategy, or concept:

Item: {concept_or_instrument}

Write the answer in this structure:

1. High-level risk overview
2. Market risk
3. Credit / counterparty risk
4. Liquidity risk
5. Operational / model risk
6. Regulatory or compliance considerations
7. How these risks are typically managed or mitigated

Keep the explanation concise but specific. Emphasize real-world
practical considerations for risk committees and front-office staff.
"""
