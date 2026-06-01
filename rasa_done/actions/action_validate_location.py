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

        print(f"🎯 Intent: {intent}, text='{text}', pending={pending_destination}")

        # # 1) ✅ ตรวจสอบการยืนยันก่อน (ย้ายมาเป็น Priority 1)
        # if pending_destination and intent == "affirm":
        #     place = pending_destination
        #     try:
        #         response = requests.post(BACKEND_URL, json={"query": place}, timeout=8)
        #         data = response.json()
        #         if response.status_code == 200 and data.get("results") and len(data["results"]) > 0:
        #             result = data["results"][0]
        #             lat, lon = result.get("lat"), result.get("lon")
        #             dispatcher.utter_message(text=f"Confirmed! Navigating to {place} (Lat: {lat}, Lon: {lon}) 🚗")
        #         else:
        #             dispatcher.utter_message(text=f"I'm sorry, I couldn't find '{place}' on the map.")
        #     except Exception as e:
        #         dispatcher.utter_message(text="Map server error.")
        #     return [SlotSet("pending_destination", None)]
        # 1) ✅ ตรวจสอบการยืนยันก่อน (ย้ายมาเป็น Priority 1)
        if pending_destination and intent == "affirm":
            place = pending_destination
            try:
                print(f"✅ [AI CONFIRMED] Start navigation to: {place}")        

                response = requests.post(
                    BACKEND_URL,
                    json={
                        "query": place,
                        "confirmed": True,
                        # "source": "rasa"
                        "source": "voice"
                    },
                    timeout=8
                )       

                print("📥 [BACKEND STATUS]", response.status_code)
                print("📥 [BACKEND RESPONSE]", response.text)       

                data = response.json()      

                if response.status_code == 200 and data.get("results") and len(data["results"]) > 0:
                    result = data["results"][0]
                    lat, lon = result.get("lat"), result.get("lon")
                    dispatcher.utter_message(text=f"Confirmed! Navigating to {place} (Lat: {lat}, Lon: {lon}) 🚗")
                else:
                    dispatcher.utter_message(text=f"I'm sorry, I couldn't find '{place}' on the map.")      

            except Exception as e:
                print("❌ [AI -> BACKEND ERROR]", e)
                dispatcher.utter_message(text="Map server error.")      

            return [SlotSet("pending_destination", None)]

        # 2) ✅ คำสั่งควบคุมรถ (คงไว้เหมือนเดิม)
        movement_intents = ["drive_left", "drive_right", "go_forward", "increase_speed", "decrease_speed", "stop_car"]
        if intent in movement_intents:
            # ... (Logic ควบคุมรถเดิมของคุณ) ...
            try:
                requests.post(COMMAND_URL, json={"command": intent}, timeout=8)
                dispatcher.utter_message(text=f"Command '{intent}' sent successfully 🚗")
            except: pass
            return []

        # 3) ✅ รับคำสั่งนำทางใหม่ (เหลือแค่ถามยืนยัน)
        destination = next((e.get("value") for e in entities if e.get("entity") == "destination"), None)
        navigation_keywords = ["go", "take", "bring", "navigate", "head", "drive", "ไป", "พา"]
        
        if (any(word in text.lower() for word in navigation_keywords) or intent == "navigate") and destination:
            # แค่ถามยืนยัน และเก็บค่าใส่ Slot (ยังไม่ต้องยิง Backend หา Lat/Lon)
            dispatcher.utter_message(text=f"I heard {destination}. Should I start navigation?")
            return [SlotSet("pending_destination", destination)]

        # 4) ✅ ยกเลิก
        if pending_destination and intent == "deny":
            dispatcher.utter_message(text=f"Okay, cancelled navigation to {pending_destination}.")
            return [SlotSet("pending_destination", None)]

        # 5) ✅ Fallback ไป LLaMA
        ask_llama(text, dispatcher)
        return []