from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests, json

BACKEND_URL = "http://localhost:3000/api/search/backend"
COMMAND_URL = "http://localhost:3000/api/command"
OLLAMA_URL = "http://localhost:11434/api/generate"


def is_strict_movement_command(text: str):
    text = text.lower().strip()
    start_keywords = ["turn", "go", "drive", "head", "move"]
    starts_with_command = any(text.startswith(k) for k in start_keywords)
    directions = ["left", "right", "forward", "straight"]
    has_direction = any(d in text for d in directions)
    return starts_with_command and has_direction


def ask_llama(prompt: str, dispatcher: CollectingDispatcher):
    try:
        final_prompt = (
            "SYSTEM: You are an AI assistant that MUST reply in English only. "
            "Never use Thai. If user speaks Thai, translate silently and answer in English.\n\n"
            f"USER: {prompt}\n"
            "ASSISTANT:"
        )

        res = requests.post(
            OLLAMA_URL,
            headers={"Content-Type": "application/json"},
            json={"model": "llama3.1", "prompt": final_prompt, "stream": False},
            timeout=15,
        )

        data = res.json()
        reply = data.get("response", "").strip()

        print("🦙 Raw (parsed) LLaMA response:", reply)

        if any("\u0E00" <= ch <= "\u0E7F" for ch in reply):
            reply = "Sorry, I can only speak English right now."

        dispatcher.utter_message(text=reply or "(No response from LLaMA.)")

    except Exception as e:
        print("⚠️ LLaMA error:", e)
        dispatcher.utter_message(text="Sorry, I can only speak English right now.")


class ActionValidateLocation(Action):
    def name(self):
        return "action_validate_location"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict):
        intent = tracker.latest_message.get("intent", {}).get("name", "")
        text = tracker.latest_message.get("text", "")
        entities = tracker.latest_message.get("entities", [])
        pending_destination = tracker.get_slot("pending_destination")

        print(f"🎯 Intent: {intent}, text='{text}', entities={entities}, pending={pending_destination}")

        # 1) Confirm navigation
        if pending_destination and intent == "affirm":
            place = pending_destination
            try:
                response = requests.post(
                    BACKEND_URL,
                    headers={"Content-Type": "application/json"},
                    json={"query": place},
                    timeout=8,
                )           

                # ✅ เช็ค HTTP ก่อน
                if response.status_code != 200:
                    dispatcher.utter_message(
                        text="I couldn't find that place. Can you try again?"
                    )
                    return [SlotSet("pending_destination", None)]           

                data = response.json()          

                # ❌ หาไม่เจอ
                if not data or len(data.get("results", [])) == 0:
                    dispatcher.utter_message(
                        text="I couldn't find that place. Can you try again?"
                    )
                    return [SlotSet("pending_destination", None)]           

                # ✅ เจอ
                result = data["results"][0]
                lat, lon = result["lat"], result["lon"]         

                dispatcher.utter_message(
                    text=f"Confirmed. Okay Starting navigation to {place}."
                )


                    # ถ้าระบบคุณต้องสั่งจริงต่ออีก endpoint ค่อยเปิดส่วนนี้
                    # requests.post(
                    #     COMMAND_URL,
                    #     headers={"Content-Type": "application/json"},
                    #     data=json.dumps({
                    #         "command": "navigate",
                    #         "destination": place,
                    #         "lat": lat,
                    #         "lon": lon
                    #     }),
                    #     timeout=8,
                    # )

            except Exception as e:
                dispatcher.utter_message(
                    text="Something went wrong. Please try again."
                )

            return [SlotSet("pending_destination", None)]

        # 2) Cancel navigation
        if pending_destination and intent == "deny":
            dispatcher.utter_message(text=f"Okay, cancelled navigation to {pending_destination}.")
            return [SlotSet("pending_destination", None)]

        # 3) Vehicle control commands
        movement_intents = [
            "drive_left", "drive_right", "go_forward",
            "increase_speed", "decrease_speed", "stop_car"
        ]

        if intent in movement_intents:
            if intent in ["drive_left", "drive_right", "go_forward"]:
                if not is_strict_movement_command(text):
                    ask_llama(text, dispatcher)
                    return []

            try:
                requests.post(
                    COMMAND_URL,
                    headers={"Content-Type": "application/json"},
                    data=json.dumps({"command": intent}),
                    timeout=8
                )
                dispatcher.utter_message(text=f"Command '{intent}' sent successfully 🚗")
            except Exception as e:
                dispatcher.utter_message(text=f"Error: {e}")
            return []

        # 4) New navigation request
        destination = None
        for e in entities:
            if e.get("entity") == "destination":
                destination = e.get("value")
                break

        navigation_keywords = ["go", "take", "bring", "navigate", "head", "drive", "ไป", "พา", "นำทาง", "เดินทาง"]

        if any(word in text.lower() for word in navigation_keywords) or intent in ["navigate", "navigate_to_place"]:
            if not destination:
                dispatcher.utter_message(text="I didn’t catch any destination.")
                return []

            # ✅ ต้องเช็ค Backend ตั้งแต่ตรงนี้เลย!
            try:
                response = requests.post(
                    BACKEND_URL,
                    headers={"Content-Type": "application/json"},
                    json={"query": destination},
                    timeout=8,
                )
                data = response.json()
                
                # ❌ ถ้าไม่เจอ ห้ามถามยืนยัน!
                if not data or len(data.get("results", [])) == 0:
                    dispatcher.utter_message(text=f"Sorry, I couldn't find '{destination}' on the map.")
                    return [SlotSet("pending_destination", None)]

                # ✅ ถ้าเจอจริงๆ ถึงจะถามยืนยัน
                dispatcher.utter_message(text=f"I found {destination}. Should I start navigation?")
                return [SlotSet("pending_destination", destination)]

            except Exception as e:
                dispatcher.utter_message(text="Navigation server error.")
                return []

        # 5) Fallback
        ask_llama(text, dispatcher)
        return []