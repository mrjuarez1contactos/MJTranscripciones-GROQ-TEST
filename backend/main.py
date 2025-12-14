import os
import time
import json
import jwt
import requests
import tempfile
import asyncio
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "dev-secret")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")  # Default to Vite local

if not GROQ_API_KEY or not GEMINI_API_KEY:
    print("Warning: API keys not set. Check .env")

# Init Clients
groq_client = Groq(api_key=GROQ_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# Init Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Init App
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
# CORS configuration - explicit origins for security
origins = [
    "http://localhost:5173",      # Vite dev
    "http://localhost:4173",      # Vite preview  
    "http://localhost:8000",      # Local backend
    "https://mj-transcripciones-groq-test.vercel.app",  # Production frontend
    "https://mj-transcripciones-groq-test-1.onrender.com",  # Production backend
    ALLOWED_ORIGIN if ALLOWED_ORIGIN else "",  # Env variable override
]

# Remove empty strings
origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# --- Models ---
class DriveRequest(BaseModel):
    file_id: str
    access_token: str
    permanent_instructions: List[str] = []

class LocalProcessRequest(BaseModel):
    # For JSON parts if needed, but we use Form data for file upload
    pass

# --- Helpers ---
def create_session_token(ip: str) -> str:
    payload = {
        "sub": "anonymous-user",
        "ip": ip,
        "exp": datetime.utcnow() + timedelta(minutes=10),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SESSION_SECRET_KEY, algorithm="HS256")

def verify_session_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = jwt.decode(token, SESSION_SECRET_KEY, algorithms=["HS256"])
        return payload
    except (ValueError, jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

async def get_gemini_summary(text: str, model_name: str, system_instruction: str = "") -> str:
    try:
        model = genai.GenerativeModel(model_name=model_name)
        # Construct proper prompt
        full_prompt = f"{system_instruction}\n\nTexto a procesar:\n{text}"
        response = await model.generate_content_async(full_prompt)
        return response.text
    except Exception as e:
        print(f"Gemini Error ({model_name}): {e}")
        return f"Error generando resumen: {str(e)}"

# --- Endpoints ---

@app.get("/api/session")
@limiter.limit("5/minute")
def get_session(request: Request):
    """Generates an ephemeral session token."""
    ip = get_remote_address(request)
    token = create_session_token(ip)
    return {"token": token, "expiresAt": (datetime.utcnow() + timedelta(minutes=10)).isoformat()}

@app.post("/api/process-local")
@limiter.limit("10/minute")
async def process_local(
    request: Request,
    file: UploadFile = File(...),
    instructions: str = "[]", # JSON stringified list
    token_payload: dict = Depends(verify_session_token)
):
    try:
        start_time = time.time()
        file_size = 0
        
        # 1. Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            chunk_size = 1024 * 1024 # 1MB chunks
            while content := await file.read(chunk_size):
                file_size += len(content)
                tmp.write(content)
            tmp_path = tmp.name

        if file_size > 25 * 1024 * 1024: # 25MB limit check (approx) -> Whisper API limit is 25MB
            os.remove(tmp_path)
            raise HTTPException(status_code=413, detail="File too large (max 25MB)")

        # 2. Transcribe with Groq
        try:
            with open(tmp_path, "rb") as audio_file:
                transcription_resp = groq_client.audio.transcriptions.create(
                    file=(file.filename, audio_file.read()),
                    model="whisper-large-v3",
                    language="es",
                    response_format="text"
                )
            transcription = transcription_resp # It returns raw text if response_format="text" or object? 
            # Groq python SDK v0.4.1 returns object with text attribute usually, but with response_format='text' it might return string.
            # Let's be safe. If it's string, good. If object, .text
            if not isinstance(transcription, str):
                transcription = transcription.text

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq Transcription failed: {str(e)}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        # 3. Summaries with Gemini
        parsed_instructions = []
        try:
            parsed_instructions = json.loads(instructions)
        except:
            pass
        
        permanent_text = ". ".join(parsed_instructions) if parsed_instructions else ""

        # General Summary
        general_prompt = "Genera un resumen general claro y conciso identificando puntos clave y acciones."
        general_summary = await get_gemini_summary(transcription, "gemini-2.5-flash", general_prompt) # Using 2.5 as requested, ensure this alias exists or change to 1.5

        # Business Summary
        business_prompt = f"Genera un resumen de negocio enfocado en mariscos. {permanent_text}"
        business_summary = await get_gemini_summary(transcription, "gemini-2.5-pro", business_prompt)

        duration = time.time() - start_time
        print(f"Processed {file.filename} ({file_size} bytes) in {duration:.2f}s")

        return {
            "fileName": file.filename,
            "transcription": transcription,
            "generalSummary": general_summary,
            "businessSummary": business_summary
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process-drive")
@limiter.limit("10/minute")
async def process_drive(
    request: Request,
    data: DriveRequest,
    token_payload: dict = Depends(verify_session_token)
):
    # This endpoint needs Google Drive API access to download the file using the USER'S access token
    # passed from frontend.
    try:
        start_time = time.time()
        
        # 1. Download file from Drive using user's token
        headers = {"Authorization": f"Bearer {data.access_token}"}
        drive_url = f"https://www.googleapis.com/drive/v3/files/{data.file_id}?alt=media"
        
        # Stream download to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as tmp:
            with requests.get(drive_url, headers=headers, stream=True) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=8192): 
                    tmp.write(chunk)
            tmp_path = tmp.name
            
        # 2. Transcribe (Groq)
        try:
            with open(tmp_path, "rb") as audio_file:
                transcription_resp = groq_client.audio.transcriptions.create(
                    file=("drive_audio.m4a", audio_file.read()),
                    model="whisper-large-v3",
                    language="es",
                    response_format="text"
                )
            transcription = transcription_resp
            if not isinstance(transcription, str):
                transcription = transcription.text
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        # 3. Summaries (Gemini)
        permanent_text = ". ".join(data.permanent_instructions) if data.permanent_instructions else ""
        
        general_prompt = "Genera un resumen general claro y conciso."
        general_summary = await get_gemini_summary(transcription, "gemini-2.5-flash", general_prompt)

        business_prompt = f"Genera un resumen de negocio enfocado en mariscos. {permanent_text}"
        business_summary = await get_gemini_summary(transcription, "gemini-2.5-pro", business_prompt)

        # 4. Upload result back to Drive (TXT)
        # We need to upload a text file.
        result_text = f"""
REGISTRO DE LLAMADA
Fecha: {datetime.now()}
-------------------
TRANSCRIPCIÓN:
{transcription}

RESUMEN GENERAL:
{general_summary}

RESUMEN NEGOCIO:
{business_summary}
"""
        metadata = {
            "name": f"Transcripcion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            "mimeType": "text/plain"
        }
        files = {
            'data': ('metadata', json.dumps(metadata), 'application/json'),
            'file': ('content.txt', result_text, 'text/plain')
        }
        # Multipart upload to Drive
        upload_resp = requests.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            headers={"Authorization": f"Bearer {data.access_token}"},
            files=files
        )
        upload_resp.raise_for_status()
        uploaded_file = upload_resp.json()

        return {
            "fileName": "drive_audio.m4a",
            "txt_file_name": uploaded_file.get("name"),
            "transcription": transcription,
            "general_summary": general_summary,
            "business_summary": business_summary
        }

    except Exception as e:
        print(f"Drive Process Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
