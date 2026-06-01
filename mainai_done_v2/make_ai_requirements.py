from importlib.metadata import version, PackageNotFoundError

packages = [
    "openai-whisper",
    "sounddevice",
    "numpy",
    "requests",
    "torch",
    "webrtcvad",
    "soundfile",
    "speechbrain",
    "scipy",
    "gTTS",
]

for pkg in packages:
    try:
        print(f"{pkg}=={version(pkg)}")
    except PackageNotFoundError:
        print(f"# NOT FOUND: {pkg}")
