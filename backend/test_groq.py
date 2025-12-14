from groq import Groq
import os

# Use a dummy key if env var not set, we just want to check attributes
api_key = os.getenv("GROQ_API_KEY", "gsk_test_1234567890") 
try:
    client = Groq(api_key=api_key)
except Exception as e:
    print(f"❌ ERROR initializing client: {e}")
    exit(1)

# Verificar que tiene el atributo audio
if hasattr(client, 'audio'):
    print("✅ SUCCESS: Groq client HAS audio attribute")
    if hasattr(client.audio, 'transcriptions'):
        print("✅ SUCCESS: client.audio.transcriptions exists")
        if hasattr(client.audio.transcriptions, 'create'):
            print("✅ SUCCESS: client.audio.transcriptions.create() method exists")
        else:
            print("❌ ERROR: create method not found")
    else:
        print("❌ ERROR: transcriptions not found")
else:
    print("❌ ERROR: Groq client DOES NOT have audio attribute")
    print("Available attributes:", dir(client))
