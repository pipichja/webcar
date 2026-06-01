from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests, json

BACKEND_URL = "http://localhost:3000/api/search/backend"
COMMAND_URL = "http://localhost:3000/api/command"
OLLAMA_URL = "http://localhost:11434/api/generate"


# -------------------------------------------------------
# Strict movement validator (กัน misfire)
# -------------------------------------------------------
def is_strict_movement_command(text: str):
    text = text.lower().strip()

    start_keywords = ["turn", "go", "drive", "head", "move"]
    starts_with_command = any(text.startswith(k) for k in start_keywords)

    directions = ["left", "right", "forward", "straight"]
    has_direction = any(d in text for d in directions)

    return starts_with_command and has_direction


# -------------------------------------------------------
# LLaMA fallback
# -------------------------------------------------------
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

        print(f"🦙 Raw (parsed) LLaMA response:", reply)

        if any("\u0E00" <= ch <= "\u0E7F" for ch in reply):
            reply = "Sorry, I can only speak English right now."

        dispatcher.utter_message(text=reply or "(No response from LLaMA.)")

    except Exception as e:
        print("⚠️ LLaMA error:", e)
        dispatcher.utter_message(text="Sorry, I can only speak English right now.")


# -------------------------------------------------------
# Main Action
# -------------------------------------------------------
class ActionValidateLocation(Action):
    def name(self):
        return "action_validate_location"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict):

        intent = tracker.latest_message.get("intent", {}).get("name", "")
        text = tracker.latest_message.get("text", "")
        entities = tracker.latest_message.get("entities", [])
        pending_destination = tracker.get_slot("pending_destination")

        print(f"🎯 Intent: {intent}, text='{text}', entities={entities}")


        # # ================================================================
        # # CONFIRM NAVIGATION (ต้องอยู่ก่อน llama)
        # # ================================================================              

        # if pending_destination and intent == "affirm":              

        #     place = pending_destination     

        #     dispatcher.utter_message(
        #         text=f"Starting navigation to {place} 🚗"
        #     )       

        #     destination = place
        #     pending_destination = None      

        # elif pending_destination and intent == "deny":              

        #     dispatcher.utter_message(text="Okay, navigation cancelled.")
        #     return [SlotSet("pending_destination", None)]


        # ================================================================
        # 1) Vehicle control commands → ส่งไป /api/command
        # ================================================================
        movement_intents = [
            "drive_left", "drive_right", "go_forward",
            "increase_speed", "decrease_speed", "stop_car"
        ]

        if intent in movement_intents:

            # เฉพาะ 3 คำสั่งเลี้ยวที่ต้อง validate
            if intent in ["drive_left", "drive_right", "go_forward"]:
                if not is_strict_movement_command(text):
                    print(f"⚠️ '{text}' is NOT a real movement command → fallback to LLaMA")
                    ask_llama(text, dispatcher)
                    return []

            print(f"🚗 Sending movement command → {intent}")

            # จัดรูปแบบ payload ให้ backend
            payload = {"command": intent}

            try:
                requests.post(
                    COMMAND_URL,
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload),
                    timeout=8,
                )
                dispatcher.utter_message(text=f"Command '{intent}' sent successfully 🚗")

            except Exception as e:
                dispatcher.utter_message(text=f"Error while sending movement command: {e}")

            return []


        # ================================================================
        # 2) Non-navigation → LLaMA
        # ================================================================
        if intent not in ["navigate", "navigate_to_place", "navigate_to_location"]:
            ask_llama(text, dispatcher)
            return []
        
        

        # ================================================================
        # 3) Navigation (ค้นหาสถานที่)
        # ================================================================
        destination = None
        for e in entities:
            if e.get("entity") == "destination":
                destination = e.get("value")
                break

        navigation_keywords = [
            "go", "take", "bring", "navigate", "head", "drive",
            "ไป", "พา", "นำทาง", "เดินทาง"
        ]

        if not any(word in text.lower() for word in navigation_keywords):
            ask_llama(text, dispatcher)
            return []

        if not destination:
            dispatcher.utter_message(
                text="I didn’t catch any destination. Please say the place name again."
            )
            return []
        
        if intent == "navigate" and not pending_destination:

         dispatcher.utter_message(
             text=f"I heard {destination}. Should I start navigation?"
         )

         return [SlotSet("pending_destination", destination)]

        place = destination.strip()

        try:
            response = requests.post(
                BACKEND_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps({"query": place}),
                timeout=8,
            )
            data = response.json()

            if data and len(data.get("results", [])) > 0:
                result = data["results"][0]
                lat, lon = result["lat"], result["lon"]

                place_name = result.get("name") or result.get("display_name", place).split(",")[0]

                dispatcher.utter_message(
                    text=f"Found {place_name} at lat={lat}, lon={lon}. Let's go to {place_name}! 🚗"
                )

            else:
                dispatcher.utter_message(
                    text=f"Sorry, I couldn’t find any place named '{place}' on the map."
                )

        except Exception as e:
            dispatcher.utter_message(text=f"Error while checking location: {e}")

        return [SlotSet("destination", None)]
