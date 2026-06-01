import warnings
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")

import whisper
import sounddevice as sd
import numpy as np
import queue
import time
import requests
import threading
import os
import torch
import subprocess
import json
import webrtcvad
import tempfile
import soundfile as sf
import re
from speechbrain.pretrained import EncoderClassifier
import torch.nn.functional as F
import scipy.signal  
from gtts import gTTS



# -------------------------
# Whisper Models
# -------------------------
print("🎧 Loading Whisper model (small)...")
device = "cuda" if torch.cuda.is_available() else "cpu"
use_fp16 = (device == "cuda") 
model = whisper.load_model("small").to(device)
wake_model = whisper.load_model("tiny").to(device)
print("✅ Whisper Models Loaded")

# -------------------------
# Speaker Encoder
# -------------------------
print("🧠 Loading Speaker Encoder (SpeechBrain ECAPA)...")
speaker_model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/spkrec-ecapa-voxceleb"
)
print("✅ Speaker Encoder Loaded")

# ====== NEW REQUIRED VARIABLES ======
last_speaker_embedding = None
speaker_threshold = 0.75     # recommended
# ====================================

# -------------------------
# Audio Settings
# -------------------------
q = queue.Queue()
mic_sample_rate = 48000   # ⭐ USB mic รองรับแน่นอน
sample_rate = 16000       # ⭐ สำหรับ Whisper / VAD

threshold = 0.05
silence_duration = 1.5
conversation_timeout = 15
tts_queue = queue.Queue()
vad = webrtcvad.Vad()
vad.set_mode(2)
frame_duration = 30
frame_size = int(sample_rate * frame_duration / 1000)

wake_word = "luna"
wake_word_active = False
last_sound_time = time.time()
is_speaking = False  # ตัวแปรเพื่อตรวจสอบว่า TTS กำลังพูดหรือไม่

def contains_thai(text):
    return any('\u0E00' <= c <= '\u0E7F' for c in text)

def speak_thai_google(text):
    try:
        tts = gTTS(text=text, lang='th')

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tts.save(tmp.name)
            subprocess.run(["mpg123", "-q", tmp.name])

        os.remove(tmp.name)

    except Exception as e:
        print("❌ Google TTS Error:", e)


# -------------------------
# TTS Worker
# -------------------------
def tts_worker():
    global is_speaking
    while True:
        text = tts_queue.get()
        if text is None:
            tts_queue.task_done()
            break

        try:
            is_speaking = True

            if contains_thai(text):
                print("🇹🇭 Using Google Thai TTS")
                speak_thai_google(text)
            else:
                print("🇬🇧 Using flite TTS")
                subprocess.run(["flite", "-voice", "slt", "-t", text])

        except Exception as e:
            print("❌ TTS Error:", e)

        finally:
            is_speaking = False
            tts_queue.task_done()


threading.Thread(target=tts_worker, daemon=True).start()

def speak_async(text):
    tts_queue.put(text)

# -------------------------
# Audio Callback
# -------------------------
def audio_callback(indata, frames, time_info, status):
    global is_speaking
    if status:
        print("⚠️ Audio status:", status)

    if is_speaking:
        return

    # indata shape: (frames, channels) -> ทำให้เป็น mono 1D
    if indata.ndim == 2:
        mono = indata[:, 0]
    else:
        mono = indata

    # (debug) ถ้าไม่อยากให้สแปม ปิดบรรทัดนี้ได้
    # print("🎧 callback", indata.shape)

     # ⭐⭐ FIX สำคัญ: downsample 48k → 16k ⭐⭐
    if mic_sample_rate != sample_rate:
        mono = scipy.signal.resample_poly(
            mono,
            sample_rate,
            mic_sample_rate
        )

    q.put(mono.copy())


# -------------------------
# Wake Word Detection
# -------------------------
def detect_wake_word(audio_block):
    tmp_path = None  # ✅ FIX: กันกรณี exception ก่อนสร้างไฟล์
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmpfile:
            sf.write(tmpfile.name, audio_block, sample_rate)
            tmp_path = tmpfile.name

        # ใช้ Whisper tiny ถอดคำ
        result = wake_model.transcribe(tmp_path, fp16=False, language="en")
        text = result["text"].lower().strip()

        print("🗣️ Wake Model:", text)

        wake_patterns = [
            "luna", "lunna", "loona", "luner", "lunaah", "lunaer",
            "lula", "luma", "lina", "lena", "lira", "lonna", "runa",
            "hey luna", "hi luna", "ok luna", "hello luna","lona","laura"
        ]

        for p in wake_patterns:
            if p in text:
                return True

        return False

    except Exception as e:
        print("❌ Wake Word Error:", e)
        return False

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# -------------------------
# Speaker Embedding Functions (FIXED)
# -------------------------
last_speaker_embedding = None
speaker_threshold = 0.75  # ปรับได้

def get_speaker_embedding(audio_block):
    # audio_block: numpy array (float32)
    # ต้องเป็น tensor shape [1, T]
    tensor = torch.from_numpy(audio_block).float().unsqueeze(0)

    with torch.no_grad():
        emb = speaker_model.encode_batch(tensor)  # ใช้ encode_batch แทน encode
        emb = emb.squeeze(0).squeeze(0)          # [1, 1, 192] -> [192]

    return emb  # shape = [192]


def is_new_speaker(audio_block):
    global last_speaker_embedding

    emb = get_speaker_embedding(audio_block)

    if last_speaker_embedding is None:
        last_speaker_embedding = emb
        print("👤 First speaker stored")
        return False

    similarity = F.cosine_similarity(emb, last_speaker_embedding, dim=0).item()
    print(f"🔍 Speaker similarity: {similarity:.2f}")

    # ถ้าเป็นคนใหม่จริง → รีเซ็ต context แต่ไม่ปลุก
    if similarity < speaker_threshold:
        print("🟢 NEW speaker detected!")
        last_speaker_embedding = emb
        return True  # ✔ return True แค่เพื่อบอกว่ามี speaker change

    last_speaker_embedding = emb
    return False


# -------------------------
# Text Normalizer
# -------------------------
def normalize_with_whisper_rules(raw_text):
    text = raw_text.strip().lower()

    corrections = {
        "cb one": "CB1", "cb 1": "CB1",
        "cb two": "CB2", "cb 2": "CB2",
        "cb three": "CB3", "cb 3": "CB3",
        "cb four": "CB4", "cb 4": "CB4",
        "cb five": "CB5", "cb 5": "CB5",
        "cpe": "CPE",
        "science": "SCI",
        "lx": "LX",
        "kmutt": "KMUTT",
        "canteen": "KMUTTCanteen","kfc":"KMUTTCanteen",
        "amazon": "Cafe Amazon",
    }

    for wrong, correct in corrections.items():
        text = re.sub(rf"\b{wrong}\b", correct, text, flags=re.IGNORECASE)


     # -------------------------
    # 2️⃣ Thai corrections (ใหม่)
    # -------------------------
    thai_corrections = {
        "ซีบีวอน": "CB1",
        "ซีบีวัน": "CB1",
        "ซีบีทู": "CB2",
        "ซีบีทรู": "CB2",
        "ซีบีทรี": "CB3",
        "ซีบีโฟร์": "CB4",
        "ซีบีไฟว์": "CB5",
        "กาไฟ": "กาแฟ",
        "คาเฟ่ อเมซอน": "Cafe Amazon",
        "ซีบีหนึ่ง": "CB1",
         "ซีบีสอง": "CB2",
         "ซีบีสาม": "CB3",
         "ซีบีสี่": "CB4",
         "cbc":"CB4",
         "ซีบีห้า": "CB5",
         "เคเอฟซี" : "KMUTT Canteen","โรงอาหาร":" KMUTT Canteen",

    }

    for wrong, correct in thai_corrections.items():
            text = re.sub(rf"{wrong}", correct, text)




    text = re.sub(r"\b(uh|um|hmm|please)\b", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    print(f"🧹 Normalized Whisper: '{raw_text}' → '{text}'")
    return text

# -------------------------
# Rasa + LLaMA Fallback
# -------------------------
OLLAMA_URL = "http://localhost:11434/api/generate"
RASA_URL = "http://localhost:5005/webhooks/rest/webhook"

def call_ollama(prompt):
    # try:
    #     response = requests.post(OLLAMA_URL, json={"model": "llama3.1", "prompt": prompt}, stream=True)
    #     full = ""
    #     for line in response.iter_lines():
    #         if not line:
    #             continue
    #         try:
    #             data = json.loads(line.decode("utf-8"))
    #             if "response" in data:
    #                 full += data["response"]
    #         except:
    #             continue
    #     return full.strip()
    # except:
    #     return None
    
    try:
        system_prompt = (
             "You are Luna, a robot assistant. "
            "Reply briefly in no more than 2 short sentences. "
            "Do not list. Do not explain too much."
    
        )

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": "llama3.1",
                "prompt": f"{system_prompt}\nUser: {prompt}\nAssistant:",
                "stream": False,
                "options": {
                    "num_predict": 60,
                    "temperature": 0.3
                }
            },
            timeout=60
        )

        data = response.json()
        return data.get("response", "").strip()

    except Exception as e:
        print("❌ LLaMA Error:", e)
        return None


def send_to_rasa(text):
    payload = {"sender": "user", "message": text}
    try:
        r = requests.post(RASA_URL, json=payload, timeout=30)
        msgs = r.json()

        for msg in msgs:
            if "text" in msg:
                reply = msg["text"]
                print("🤖 Rasa:", reply)
                speak_async(reply)

                if "ไม่พบ" in reply or "ไม่เข้าใจ" in reply:
                    fallback = call_ollama(text)
                    if fallback:
                        print("🦙 LLaMA Fallback:", fallback)
                        speak_async(fallback)

    except:
        fallback = call_ollama(text)
        if fallback:
            print("🦙 LLaMA Error Fallback:", fallback)
            speak_async(fallback)

# -------------------------
# VAD
# -------------------------
def is_speech_present(audio_data):
    int16_audio = (audio_data * 32768).astype(np.int16).tobytes()
    speech_frames = 0
    total_frames = 0

    for start in range(0, len(int16_audio), frame_size * 2):
        frame = int16_audio[start:start + frame_size * 2]
        if len(frame) < frame_size * 2:
            continue

        total_frames += 1
        if vad.is_speech(frame, sample_rate):
            speech_frames += 1

    return total_frames > 0 and (speech_frames / total_frames) > 0.3

def select_input_device():
    devices = sd.query_devices()
    for i, d in enumerate(devices):
        if d["max_input_channels"] > 0:
            name = d["name"].lower()
            if "usb" in name or "speakerphone" in name:
                print(f"🎤 Using external mic: {d['name']} (index {i})")
                return i
    print("🎤 Using default microphone")
    return None

input_device = select_input_device()

# -------------------------
# Main Loop
# -------------------------
audio_buffer = []

with sd.InputStream(
    device=input_device,
    samplerate=mic_sample_rate,   # ⭐ ใช้ rate ของไมค์
    channels=1,
    dtype="float32",
    blocksize=int(mic_sample_rate * frame_duration / 1000),
    callback=audio_callback
):

    print("🎙️ Start speaking... (Ctrl+C to stop)")
    try:
        while True:
            try:
                chunk = q.get(timeout=1.0)
            except queue.Empty:
                print("🟡 No audio chunk received")
                continue

            audio_buffer.append(chunk)

            # ✅ FIX: ใช้ทั้ง RMS + VAD เพื่ออัปเดต last_sound_time
            rms = np.sqrt(np.mean(chunk ** 2))
            if rms > threshold:
                last_sound_time = time.time()

            # ✅ FIX: indent ถูกต้อง + VAD ช่วยกัน noise หลอก
            if vad.is_speech((chunk * 32768).astype(np.int16).tobytes(), sample_rate):
                last_sound_time = time.time()

            if (time.time() - last_sound_time > silence_duration) and (len(audio_buffer) > 0):
                audio_block = np.concatenate(audio_buffer, axis=0).flatten()

                if is_speech_present(audio_block):
                    if not wake_word_active:
                        if detect_wake_word(audio_block):
                            wake_word_active = True
                            last_speaker_embedding = None
                            print("🔔 Wake word detected!")
                            speak_async("Hello! I am listening now.")
                    else:
                        print("🎧 Processing...")


                        result = model.transcribe(
                        audio_block,
                        fp16=use_fp16,
                        language="en",   # ✅ ฟังเป็นภาษาอังกฤษอย่างเดียว
                        temperature=0.0,
                        condition_on_previous_text=False
                        )

                        # # 1️⃣ detect language ก่อน
                        # detect_result = model.transcribe(
                        #     audio_block,
                        #     fp16=use_fp16,
                        #     temperature=0.0,
                        #     condition_on_previous_text=False,
                        #     task="transcribe"
                        # )                       

                        # detected_lang = detect_result.get("language")
                        # print("🌐 Detected language:", detected_lang)                       

                        # # 2️⃣ ล็อกให้เหลือแค่ th หรือ en
                        # if detected_lang not in ["th", "en"]:
                        #     print("⚠️ Unsupported language, forcing English")
                        #     detected_lang = "en"

                        # result = model.transcribe(
                        #     audio_block,
                        #     fp16=use_fp16,  
                        #     # language="en",
                        #     language=detected_lang,
                        #     temperature=0.0,
                        #     condition_on_previous_text=False
                        # )
                        text = result["text"].strip().lower()
                        print("📌 You said:", text)

                        if text:
                            if ("go to sleep" in text) or ("bye" in text) or ("บ้ายบาย" in text):
                                wake_word_active = False
                                speak_async("Okay, going to sleep.")
                            else:
                                normalized = normalize_with_whisper_rules(text)
                                send_to_rasa(normalized)
                                last_sound_time = time.time()

                    if wake_word_active and (time.time() - last_sound_time > conversation_timeout):
                        wake_word_active = False
                        speak_async("Going back to sleep.")
                        print("😴 Auto-sleep mode")
                else:
                    print("🧹 Silent")

                audio_buffer = []
                last_sound_time = time.time()

    except KeyboardInterrupt:
        print("🛑 Stopped")
        tts_queue.put(None)

