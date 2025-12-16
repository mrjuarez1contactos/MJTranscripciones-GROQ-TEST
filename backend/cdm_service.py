"""\nCDM Service - Automated Google Sheets Creation for Users\nAutomatically creates and deploys Google Sheets with Apps Script for each new user\n"""

import os
import json
import time
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from typing import Dict, Optional

# Google API Scopes
SCOPES_SHEETS = ['https://www.googleapis.com/auth/spreadsheets']
SCOPES_DRIVE = ['https://www.googleapis.com/auth/drive']

class CDMService:
    """Service to manage CDM (Google Sheets) creation for users"""
    
    def __init__(self, service_account_key: Dict):
        """
        Initialize CDM Service with Google credentials
        Args:
            service_account_key: Google Service Account JSON credentials
        """
        self.credentials_dict = service_account_key
        self.sheets_service = None
        self.drive_service = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Google APIs"""
        try:
            credentials = Credentials.from_service_account_info(
                self.credentials_dict,
                scopes=SCOPES_SHEETS + SCOPES_DRIVE
            )
            self.sheets_service = build('sheets', 'v4', credentials=credentials)
            self.drive_service = build('drive', 'v3', credentials=credentials)
            print("[CDM] Authenticated with Google APIs successfully")
        except Exception as e:
            raise Exception(f"[CDM] Authentication failed: {str(e)}")
    
    def create_user_sheet(self, user_id: str, user_email: str, user_name: str = None) -> Dict:
        """
        Create a new Google Sheet for a user with the CDM structure
        Args:
            user_id: Unique user identifier
            user_email: User email (for sharing)
            user_name: User display name
        Returns:
            Dict with sheet_id, sheet_url, and script_url
        """
        try:
            # 1. Create Google Sheet
            sheet_name = f"CDM - {user_name or user_email}"
            sheet_body = {
                'properties': {
                    'title': sheet_name
                },
                'sheets': [
                    {'properties': {'title': 'Transcripciones'}},
                    {'properties': {'title': 'Logs'}},
                    {'properties': {'title': 'Config'}}
                ]
            }
            
            sheet = self.sheets_service.spreadsheets().create(
                body=sheet_body
            ).execute()
            
            sheet_id = sheet['spreadsheetId']
            sheet_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
            
            print(f"[CDM] Created sheet for user {user_id}: {sheet_id}")
            
            # 2. Initialize sheet tabs with headers
            self._initialize_sheet_tabs(sheet_id)
            
            # 3. Share sheet with user
            self._share_sheet_with_user(sheet_id, user_email)
            
            # 4. Create Apps Script for this sheet (will be deployed separately)
            script_info = {
                'sheet_id': sheet_id,
                'script_url': f"https://script.google.com/macros/d/DEPLOYMENT_ID/userweb",
                'status': 'pending_deployment'
            }
            
            result = {
                'user_id': user_id,
                'sheet_id': sheet_id,
                'sheet_url': sheet_url,
                'sheet_name': sheet_name,
                'script_info': script_info,
                'created_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return result
            
        except HttpError as e:
            raise Exception(f"[CDM] Error creating sheet: {str(e)}")
    
    def _initialize_sheet_tabs(self, sheet_id: str):
        """Initialize sheet tabs with proper headers"""
        try:
            # Transcripciones tab headers
            requests_list = [
                {
                    'updateCells': {
                        'range': {'sheetId': 0, 'rowIndex': 0, 'columnIndex': 0},
                        'rows': [{
                            'values': [
                                {'userEnteredValue': {'stringValue': 'id'}},
                                {'userEnteredValue': {'stringValue': 'transcripcion'}},
                                {'userEnteredValue': {'stringValue': 'archivo'}},
                                {'userEnteredValue': {'stringValue': 'resumen_general'}},
                                {'userEnteredValue': {'stringValue': 'resumen_negocio'}},
                                {'userEnteredValue': {'stringValue': 'fecha'}},
                                {'userEnteredValue': {'stringValue': 'estado'}}
                            ]
                        }],
                        'fields': 'userEnteredValue'
                    }
                },
                # Logs tab headers
                {
                    'updateCells': {
                        'range': {'sheetId': 1, 'rowIndex': 0, 'columnIndex': 0},
                        'rows': [{
                            'values': [
                                {'userEnteredValue': {'stringValue': 'timestamp'}},
                                {'userEnteredValue': {'stringValue': 'evento'}},
                                {'userEnteredValue': {'stringValue': 'detalle'}}
                            ]
                        }],
                        'fields': 'userEnteredValue'
                    }
                },
                # Config tab headers
                {
                    'updateCells': {
                        'range': {'sheetId': 2, 'rowIndex': 0, 'columnIndex': 0},
                        'rows': [{
                            'values': [
                                {'userEnteredValue': {'stringValue': 'clave'}},
                                {'userEnteredValue': {'stringValue': 'valor'}}
                            ]
                        }],
                        'fields': 'userEnteredValue'
                    }
                }
            ]
            
            self.sheets_service.spreadsheets().batchUpdate(
                spreadsheetId=sheet_id,
                body={'requests': requests_list}
            ).execute()
            
            print(f"[CDM] Initialized tabs for sheet {sheet_id}")
            
        except Exception as e:
            print(f"[CDM] Warning: Could not initialize tabs: {str(e)}")
    
    def _share_sheet_with_user(self, sheet_id: str, user_email: str):
        """Share the sheet with the user"""
        try:
            self.drive_service.permissions().create(
                fileId=sheet_id,
                body={
                    'kind': 'drive#permission',
                    'role': 'owner',
                    'type': 'user',
                    'emailAddress': user_email
                }
            ).execute()
            
            print(f"[CDM] Shared sheet {sheet_id} with {user_email}")
            
        except Exception as e:
            print(f"[CDM] Warning: Could not share sheet: {str(e)}")


# Example usage
if __name__ == '__main__':
    # This would be loaded from environment variables
    service_account_key = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY', '{}'))
    
    if service_account_key:
        cdm = CDMService(service_account_key)
        # Example: create sheet for new user
        result = cdm.create_user_sheet(
            user_id='user123',
            user_email='user@example.com',
            user_name='John Doe'
        )
        print(json.dumps(result, indent=2))
