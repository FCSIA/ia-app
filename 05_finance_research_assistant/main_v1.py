# main_v1.py

import os
from dotenv import load_dotenv
from openai import OpenAI

from prompt_templates import (
    explain_concept_prompt,
    compare_concepts_prompt,
    risk_summary_prompt,
)

# 1) Load environment variables from .env
#    Make sure .env contains: OPENAI_API_KEY=sk-...
load_dotenv()  # looks for .env in current directory by default

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set. Check your .env file.")

# 2) Create OpenAI client
client = OpenAI(api_key=api_key)


def explain_concept(concept: str) -> str:
    """
    Call the LLM to explain a single financial concept
    using the explain_concept_prompt template.
    """
    prompt = explain_concept_prompt(concept)

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {
                "role": "system",
                "content": "You are a precise, reliable financial trainer.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )

    # For now, just grab the plain text output
    return response.output[0].content[0].text


def main():
    print("Finance Research Assistant (v1)")
    print("--------------------------------")
    user_concept = input("Enter a financial concept to explain (e.g. 'credit default swap'): ")

    print("\nThinking...\n")
    answer = explain_concept(user_concept)

    print("=== Explanation ===\n")
    print(answer)
    print("\n===================")


if __name__ == "__main__":
    main()
