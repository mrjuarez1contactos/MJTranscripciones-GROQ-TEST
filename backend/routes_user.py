"""\nUser Routes - CDM Sheet Creation\nEndpoints for creating and managing user CDM sheets\n"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import json
import os
from cdm_service import CDMService

router = APIRouter(prefix="/api", tags=["user"])

# Pydantic Models
class CreateSheetRequest(BaseModel):
    user_id: str
    user_email: str
    user_name: str = None

class CreateSheetResponse(BaseModel):
    user_id: str
    sheet_id: str
    sheet_url: str
    sheet_name: str
    script_info: dict
    created_at: str

# Initialize CDM Service (this will be called once on startup)
cdm_service = None

def init_cdm_service():
    """Initialize CDM Service with Google credentials"""
    global cdm_service
    try:
        service_account_key_str = os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY')
        if not service_account_key_str:
            raise ValueError("GOOGLE_SERVICE_ACCOUNT_KEY not found in environment")
        
        service_account_key = json.loads(service_account_key_str)
        cdm_service = CDMService(service_account_key)
        print("[CDM Routes] CDMService initialized successfully")
    except Exception as e:
        print(f"[CDM Routes] Error initializing CDMService: {str(e)}")
        cdm_service = None

@router.post("/user/create-sheet", response_model=CreateSheetResponse)
async def create_user_sheet(request: CreateSheetRequest) -> CreateSheetResponse:
    """
    Create a new CDM Sheet for a user
    
    This endpoint:
    1. Creates a new Google Sheet with CDM structure
    2. Initializes tabs (Transcripciones, Logs, Config)
    3. Shares the sheet with the user
    4. Returns sheet metadata
    
    Args:
        request: CreateSheetRequest with user_id, user_email, user_name
    
    Returns:
        CreateSheetResponse with sheet details
    """
    try:
        if cdm_service is None:
            raise HTTPException(
                status_code=500,
                detail="CDM Service not initialized. Check GOOGLE_SERVICE_ACCOUNT_KEY environment variable."
            )
        
        # Validate input
        if not request.user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        if not request.user_email:
            raise HTTPException(status_code=400, detail="user_email is required")
        
        print(f"[CDM Routes] Creating sheet for user: {request.user_id}")
        
        # Create sheet
        result = cdm_service.create_user_sheet(
            user_id=request.user_id,
            user_email=request.user_email,
            user_name=request.user_name
        )
        
        print(f"[CDM Routes] Sheet created successfully: {result['sheet_id']}")
        
        return CreateSheetResponse(**result)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[CDM Routes] Error creating sheet: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating sheet: {str(e)}"
        )

@router.get("/health/cdm")
async def health_check() -> dict:
    """
    Health check for CDM Service
    """
    return {
        "status": "ok" if cdm_service else "error",
        "cdm_initialized": cdm_service is not None
    }
