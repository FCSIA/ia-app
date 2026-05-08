"""
04_agent_basic: a tiny agent loop using OpenAI.

The agent:
- Takes a high-level goal from the user
- Lets the model think in small steps
- Stops when the model says the task is finished
"""

from dotenv import load_dotenv
from openai import OpenAI
import os

# ---------- 1. Setup ----------

# Load OPENAI_API_KEY from .env
load_dotenv()
client = OpenAI()  # reads OPENAI_API_KEY automatically


# ---------- 2. A tiny "tool" example (optional) ----------

def calculator(expression: str) -> str:
    """
    Very simple calculator tool.
    WARNING: uses eval(), so only for safe trusted input in this toy example.
    """
    try:
        result = eval(expression, {"__builtins__": {}})
        return f"The result of {expression} is {result}."
    except Exception as e:
        return f"Error evaluating expression {expression!r}: {e}"


# ---------- 3. Agent loop ----------

AGENT_SYSTEM_PROMPT = """
You are a helpful step-by-step problem solver.

You work in LOOPS.
On each step you must respond in **exactly** one of these formats:

1) THINK step (continue working):
THINK:
<your reasoning about the next step>

2) FINISH step (you are done and give final answer):
FINISH:
<your final answer for the user>

GENERAL RULES:
- Use simple language.
- Take small steps. THINK for a few steps before FINISH if the task is not trivial.
- You can call a CALCULATOR tool by outputting an expression like CALC[2+2]. But for now, just describe what you would calculate.
"""


def call_model(messages: list[dict]) -> str:
    """
    Helper to call the OpenAI Responses API with a chat-like history.
    `messages` is a list of dicts with 'role' and 'content'.
    """
    # Turn messages into a single text prompt for simplicity.
    # For a more advanced design you would keep messages structured,
    # but this is enough to show the agent loop idea.

    conversation_text = ""
    for m in messages:
        role = m["role"].upper()
        content = m["content"]
        conversation_text += f"{role}: {content}\n\n"

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=conversation_text,
    )
    return response.output_text


def run_agent(goal: str, max_steps: int = 8) -> str:
    """
    Run the agent loop until it reaches FINISH or hits max_steps.
    Returns the final answer string.
    """
    print(f"[agent] Starting new run with goal: {goal!r}")

    messages: list[dict] = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Your goal: {goal}"},
    ]

    final_answer = "Agent did not finish."

    for step in range(1, max_steps + 1):
        print(f"\n[agent] ----- STEP {step} -----")

        # 1) Ask the model what to do next
        model_output = call_model(messages)
        print(f"[agent] Model raw output:\n{model_output}\n")

        # 2) Add model message to history
        messages.append({"role": "assistant", "content": model_output})

        # 3) Interpret its response
        text = model_output.strip()

        if text.startswith("THINK:"):
            # The agent is still reasoning, not done yet
            think_content = text[len("THINK:"):].strip()
            print(f"[agent] THINK step: {think_content}")

            # Optionally, we could parse for CALC[...] and call the calculator tool.
            # For now we just continue.
            continue

        elif text.startswith("FINISH:"):
            # The agent says it's done
            final_answer = text[len("FINISH:"):].strip()
            print(f"[agent] FINISH step reached.")
            break

        else:
            # Format not respected; treat as final answer to be safe
            final_answer = text
            print("[agent] Unexpected format. Treating as final answer.")
            break

    print("\n[agent] Run complete.")
    return final_answer


# ---------- 4. Simple CLI ----------

def main():
    print("=== 04_agent_basic ===")
    goal = input("Describe your goal (what do you want the agent to do?):\n> ")
    answer = run_agent(goal)
    print("\n=== FINAL ANSWER ===")
    print(answer)
    print("=====================")


if __name__ == "__main__":
    main()
