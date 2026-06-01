from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import UserUtteranceReverted
import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

# -----------------------------------------------------------
# SAFE SYSTEM PROMPT (สำคัญที่สุด)
# -----------------------------------------------------------
SAFE_SYSTEM_PROMPT = """
You are Luna, the AI assistant of an autonomous campus vehicle.

Only mention abilities the REAL system has:

✔ You can guide the user around campus.
✔ You can find locations and help the navigation system.
✔ You can help with campus navigation.
✔ You can answer simple general questions.
✔ You can have casual friendly conversations with the user.

❌ You cannot directly control the vehicle movement such as turning left, turning right, moving forward, or stopping.
❌ You cannot open doors or gates.
❌ You cannot call, text, or access phones.
❌ You cannot control devices or elevators.
❌ You cannot access class schedules or private data.

Important behavior:
- If the user asks you to navigate to a place, help them with navigation.
- If the user asks you to turn left, turn right, move forward, or stop, politely say that you cannot directly control the vehicle yet.
- If the user just wants to chat, talk casually and naturally.
- Always answer honestly.
- Keep answers short and clear.
- Reply in the same language as the user.
"""

# -----------------------------------------------------------
# FALLBACK ACTION (LLaMA ONLY)
# -----------------------------------------------------------
class ActionDefaultFallback(Action):
    def name(self):
        return "action_default_fallback"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict):

        text = tracker.latest_message.get("text", "")
        print(f"💬 Fallback to LLaMA: {text}")

        try:
            # 🧠 Combine SYSTEM + USER prompt
            final_prompt = (
                SAFE_SYSTEM_PROMPT
                + "\nUser said: " + text
                + "\nAssistant:"
            )

            res = requests.post(
                OLLAMA_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "model": "llama3.1:latest",
                    "prompt": final_prompt,
                    "stream": False
                },
                timeout=60
            )       
    
            print("STATUS:", res.status_code)
            print("RAW:", res.text)     
    
            data = res.json()       
    
            print("PARSED:", data)

          

            data = res.json()
            reply = data.get("response", "").strip()

            if not reply:
                reply = "(No response from LLaMA)"

            dispatcher.utter_message(text=reply)

        except Exception as e:
            dispatcher.utter_message(text=f"(LLaMA fallback error: {e})")

        # 🔥 CRITICAL: Prevent fallback infinite loop
        return [UserUtteranceReverted()]
