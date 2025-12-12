# Migración Backend: Gemini → Groq + Gemini

## ⚠️ IMPORTANTE
Este archivo contiene instrucciones para modificar el backend desplegado en Render.
NO aplicar estos cambios al repositorio MJTranscripciones (producción).

## 1. Agregar dependencia de Groq

En `requirements.txt` de Render, agrega:
```text
groq==0.4.1
```

## 2. Variables de entorno en Render Dashboard

Ir a: https://dashboard.render.com → Tu servicio → Environment

Agregar:
```text
GROQ_API_KEY=gsk_TU_API_KEY_DE_GROQ_AQUI

```

## 3. Modificar main.py

### A. Importar Groq (agregar al inicio del archivo)

```python
from groq import Groq
import os

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
```

### B. Modificar endpoint /transcribe

Buscar esta sección:
```python
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # ... código existente ...
    
    # BUSCAR ESTA LÍNEA:
    model = genai.GenerativeModel(model_name="gemini-2.5-flash", ...)
    response = await model.generate_content_async("Transcribe this audio recording.", audio_part)
    transcription = response.text
```

Reemplazar con:
```python
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # ... mantener código anterior ...
    
    # NUEVO: Guardar archivo temporalmente
    temp_path = f"/tmp/{file.filename}"
    try:
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # NUEVO: Transcribir con Groq en lugar de Gemini
        with open(temp_path, "rb") as audio_file:
            transcription_response = groq_client.audio.transcriptions.create(
                file=(file.filename, audio_file.read()),
                model="whisper-large-v3",
                language="es",
                response_format="text"
            )
            transcription = transcription_response.text
    finally:
        # Limpiar archivo temporal
        if os.path.exists(temp_path):
            os.remove(temp_path)
    
    return {"transcription": transcription, "fileName": file.filename}
```

### C. Modificar endpoint /transcribe-from-drive

Buscar esta sección:
```python
# Dentro de transcribe_from_drive, buscar:
model_flash = genai.GenerativeModel(model_name="gemini-2.5-flash", ...)
response_flash = await model_flash.generate_content_async("Transcribe this audio recording.", audio_part)
transcription = response_flash.text
```

Reemplazar con:
```python
# Guardar audio de Drive temporalmente
temp_path = f"/tmp/{new_name}"
try:
    with open(temp_path, "wb") as f:
        f.write(file_bytes_io.getvalue())
    
    # Transcribir con Groq
    with open(temp_path, "rb") as audio_file:
        transcription_response = groq_client.audio.transcriptions.create(
            file=(new_name, audio_file.read()),
            model="whisper-large-v3",
            language="es",
            response_format="text"
        )
        transcription = transcription_response.text
finally:
    if os.path.exists(temp_path):
        os.remove(temp_path)

# IMPORTANTE: MANTENER TODO LO DEMÁS IGUAL
# Los resúmenes con Gemini 2.5-Pro NO cambian:
# - summarize-general → sigue con Gemini
# - summarize-business → sigue con Gemini
```

## 4. Checklist de Deploy en Render

- [ ] Actualizar requirements.txt con groq==0.4.1
- [ ] Agregar variable GROQ_API_KEY en Environment
- [ ] Modificar main.py con los cambios de arriba
- [ ] Hacer commit y push (deploy automático)
- [ ] Verificar logs: "Transcribiendo con Groq..."
- [ ] Probar un archivo de prueba
- [ ] Monitorear costos en https://console.groq.com

## 5. Rollback en caso de problemas

Si algo falla, revertir a Gemini:

```python
# Volver a usar Gemini temporalmente
model = genai.GenerativeModel(model_name="gemini-2.5-flash")
response = await model.generate_content_async(...)
```
