# 1. Import libraries we need
from dotenv import load_dotenv  # to read .env file
from openai import OpenAI       # OpenAI Python SDK
import os                       # to work with environment variables

# 2. Load variables from .env into environment
load_dotenv()  # looks for a file named ".env" in this folder

# 3. Create the OpenAI client
# The client will automatically read the OPENAI_API_KEY from environment
client = OpenAI()

def ask_model(question: str) -> str:
    """
    Send the user's question to the OpenAI model and get back the answer as text.
    """
    # 4. Call the OpenAI Responses API
    response = client.responses.create(
        model="gpt-4.1-mini",   # small, cheap, good enough to start
        input=question
    )

    # 5. Convert the response to plain text
    # The SDK provides a helper to extract the text answer
    answer_text = response.output_text

    return answer_text

def main():
    print("Welcome to 01_llm_basic!")
    # 6. Ask the user for a question
    user_question = input("Type your question and press Enter:\n> ")

    # 7. Call our helper function to talk to the model
    answer = ask_model(user_question)

    # 8. Print the model's answer
    print("\n--- Model answer ---")
    print(answer)
    print("--------------------")

if __name__ == "__main__":
    main()
