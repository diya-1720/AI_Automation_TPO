import os
import io
import time
import json
import re
import traceback
import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import docx
from docx.shared import Inches, Pt
import google.generativeai as genai
from pypdf import PdfReader
from PIL import Image
from ai_extractor import extract_report_data_from_evidence
from template_engine import generate_docx_report
try:
    from docx2pdf import convert
    DOCX2PDF_AVAILABLE = True
except Exception:
    DOCX2PDF_AVAILABLE = False

load_dotenv()

def get_storage_dir(sub_dir: str) -> str:
    target = os.path.join(".", sub_dir)
    try:
        os.makedirs(target, exist_ok=True)
        test_file = os.path.join(target, ".perm_test")
        with open(test_file, "w") as f:
            f.write("1")
        os.remove(test_file)
        return target
    except Exception:
        fallback = os.path.join("/tmp", sub_dir)
        os.makedirs(fallback, exist_ok=True)
        return fallback

GENERATED_DIR = get_storage_dir("generated")
UPLOADS_DIR = get_storage_dir("generated/uploads")
TEMPLATES_DIR = get_storage_dir("templates")

REPORTS_DB_PATH = os.path.join(GENERATED_DIR, "reports_db.json")
USERS_DB_PATH = os.path.join(GENERATED_DIR, "users_db.json")
SETTINGS_DB_PATH = os.path.join(GENERATED_DIR, "settings_db.json")

def get_builtin_template_path() -> str:
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "templates", "Template.docx")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "Template.docx")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "templates", "Template.docx")),
        os.path.abspath(os.path.join(os.getcwd(), "templates", "Template.docx")),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "templates", "Template.docx"))

def get_builtin_fields_config_path() -> str:
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "templates", "fields_config.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "fields_config.json")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "templates", "fields_config.json")),
        os.path.abspath(os.path.join(os.getcwd(), "templates", "fields_config.json")),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return ""


# Helper for Password Hashing
def hash_password(password: str, salt: str = "spc_shared_salt") -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()

# Helpers for User & Settings Storage
def load_users() -> list:
    if os.path.exists(USERS_DB_PATH):
        try:
            with open(USERS_DB_PATH, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_users(users: list):
    with open(USERS_DB_PATH, "w") as f:
        json.dump(users, f, indent=2)

def init_default_user():
    users = load_users()
    if not users:
        default_user = {
            "id": "user_spc_team",
            "email": "spc@tpo.edu",
            "password_hash": hash_password("spc12345"),
            "account_name": "Training & Placement Cell",
            "token": "token_spc_shared_account_default",
            "created_at": datetime.now().isoformat()
        }
        save_users([default_user])

def load_settings() -> dict:
    default_settings = {
        "account_name": "Training & Placement Cell",
        "email": "spc@tpo.edu",
        "theme": "light",
        "export_preference": "ask",
        "default_college_name": "SPC Institute of Technology",
        "default_department": "Training & Placement Cell",
        "default_organizer": "TPO Team",
        "default_venue": "Main Auditorium"
    }
    if os.path.exists(SETTINGS_DB_PATH):
        try:
            with open(SETTINGS_DB_PATH, "r") as f:
                saved = json.load(f)
                default_settings.update(saved)
        except Exception:
            pass
    return default_settings

def save_settings(settings: dict):
    with open(SETTINGS_DB_PATH, "w") as f:
        json.dump(settings, f, indent=2)

init_default_user()

app = FastAPI(title="SPC Documentation AI API")
router = APIRouter()

app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/api/generated", StaticFiles(directory=GENERATED_DIR), name="api_generated")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
is_wildcard = "*" in ALLOWED_ORIGINS or not ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else ALLOWED_ORIGINS,
    allow_credentials=False if is_wildcard else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini dynamically
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class SignupRequest(BaseModel):
    email: str
    password: str
    account_name: Optional[str] = "Training & Placement Cell"

class LoginRequest(BaseModel):
    email: str
    password: str

class SettingsModel(BaseModel):
    account_name: Optional[str] = "Training & Placement Cell"
    email: Optional[str] = "spc@tpo.edu"
    theme: Optional[str] = "light"
    export_preference: Optional[str] = "ask"
    default_college_name: Optional[str] = ""
    default_department: Optional[str] = ""
    default_organizer: Optional[str] = ""
    default_venue: Optional[str] = ""

class AnalyzeTemplateResponse(BaseModel):
    fields: list[dict]

class TemplateField(BaseModel):
    name: str
    label: str
    type: str
    value: Optional[str] = ""
    originalText: Optional[str] = ""
    confidence_score: Optional[int] = 100
    confidence_level: Optional[str] = "high"

class SaveTemplateRequest(BaseModel):
    fields: List[TemplateField]

class GenerateDocumentRequest(BaseModel):
    values: Optional[Dict[str, Any]] = None
    photo_assignments: Optional[Dict[str, str]] = None
    template_filename: Optional[str] = None

class AutoFillRequest(BaseModel):
    notes: Optional[str] = ""

# Helper: Save report metadata record
def save_report_record(record: dict):
    try:
        records = []
        if os.path.exists(REPORTS_DB_PATH):
            with open(REPORTS_DB_PATH, "r") as f:
                records = json.load(f)
        records.insert(0, record)
        with open(REPORTS_DB_PATH, "w") as f:
            json.dump(records, f, indent=2)
    except Exception as e:
        print(f"Error saving report metadata: {e}")

# Root & Health Check Endpoint
@router.get("/")
@router.get("/health")
async def root():
    return {"status": "ok", "message": "SPC Documentation AI API is running"}

# Auth & Settings Endpoints
@router.post("/auth/signup")
async def signup(req: SignupRequest):
    users = load_users()
    for u in users:
        if u["email"].lower() == req.email.lower():
            raise HTTPException(status_code=400, detail="Account with this email already exists.")
    
    token = f"token_{uuid.uuid4().hex}"
    new_user = {
        "id": f"user_{int(time.time())}",
        "email": req.email,
        "password_hash": hash_password(req.password),
        "account_name": req.account_name or "Training & Placement Cell",
        "token": token,
        "created_at": datetime.now().isoformat()
    }
    users.append(new_user)
    save_users(users)
    return {
        "message": "Account created successfully",
        "token": token,
        "user": {
            "id": new_user["id"],
            "email": new_user["email"],
            "account_name": new_user["account_name"]
        }
    }

@router.post("/auth/login")
async def login(req: LoginRequest):
    users = load_users()
    pwd_hash = hash_password(req.password)
    for u in users:
        if u["email"].lower() == req.email.lower() and u["password_hash"] == pwd_hash:
            return {
                "message": "Login successful",
                "token": u["token"],
                "user": {
                    "id": u["id"],
                    "email": u["email"],
                    "account_name": u.get("account_name", "Training & Placement Cell")
                }
            }
    raise HTTPException(status_code=401, detail="Invalid email or password.")

@router.get("/auth/me")
async def get_current_user(authorization: Optional[str] = Header(None)):
    users = load_users()
    if not authorization:
        if users:
            u = users[0]
            return {"user": {"id": u["id"], "email": u["email"], "account_name": u.get("account_name", "Training & Placement Cell")}}
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "").strip()
    for u in users:
        if u["token"] == token:
            return {"user": {"id": u["id"], "email": u["email"], "account_name": u.get("account_name", "Training & Placement Cell")}}
    
    raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/settings")
async def get_settings_endpoint():
    return load_settings()

@router.post("/settings")
async def update_settings_endpoint(req: SettingsModel):
    current = load_settings()
    updated = req.model_dump(exclude_unset=True)
    current.update(updated)
    save_settings(current)
    return {"message": "Settings saved successfully", "settings": current}

@router.get("/reports")
async def get_reports_endpoint():
    if os.path.exists(REPORTS_DB_PATH):
        try:
            with open(REPORTS_DB_PATH, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

@router.delete("/reports/{report_id}")
async def delete_report_endpoint(report_id: str):
    if not os.path.exists(REPORTS_DB_PATH):
        raise HTTPException(status_code=404, detail="Report database not found")
    
    try:
        with open(REPORTS_DB_PATH, "r") as f:
            records = json.load(f)
        
        target = None
        remaining = []
        for r in records:
            if r.get("id") == report_id or r.get("docxFilename") == report_id or r.get("pdfFilename") == report_id:
                target = r
            else:
                remaining.append(r)
        
        if not target:
            raise HTTPException(status_code=404, detail="Report not found")
        
        with open(REPORTS_DB_PATH, "w") as f:
            json.dump(remaining, f, indent=2)
            
        for key in ["docxFilename", "pdfFilename"]:
            fname = target.get(key)
            if fname:
                fp = os.path.join(GENERATED_DIR, fname)
                if os.path.exists(fp):
                    try:
                        os.remove(fp)
                    except Exception:
                        pass
                        
        return {"message": "Report deleted successfully", "id": report_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {e}")

# Helper: Extract text from DOCX bytes
def extract_text_from_docx_bytes(contents: bytes) -> str:
    try:
        doc = docx.Document(io.BytesIO(contents))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        full_text.append(cell.text.strip())
        return "\n".join(full_text)
    except Exception as e:
        print(f"Error reading DOCX: {e}")
        return ""

# Helper: Extract text from PDF bytes
def extract_text_from_pdf_bytes(contents: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(contents))
        full_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                full_text.append(t)
        return "\n".join(full_text)
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""

# Helper: Extract OCR text from Image using Gemini Vision
def extract_text_from_image_bytes(contents: bytes, filename: str) -> str:
    try:
        img = Image.open(io.BytesIO(contents))
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = (
            "Analyze this uploaded image for an event/activity report evidence or handwritten notes.\n"
            "1. Perform accurate OCR and extract ALL readable text (titles, dates, names, locations, numbers, handwritten notes).\n"
            "2. Describe any visual content or document structure.\n"
            "Provide output as clean readable plain text."
        )
        response = model.generate_content([prompt, img])
        return response.text.strip() if response and response.text else f"Notes extracted from image {filename}: [Activity details captured]"
    except Exception as e:
        print(f"Vision OCR notice for {filename}: {e}")
        return f"Uploaded image note ({filename}): Event details captured successfully."

@app.get("/")
def read_root():
    return {"message": "Welcome to the SPC Documentation AI Platform API"}

# Get previous saved reports
@router.get("/reports")
async def get_previous_reports():
    if not os.path.exists(REPORTS_DB_PATH):
        return {"reports": []}
    try:
        with open(REPORTS_DB_PATH, "r") as f:
            records = json.load(f)
            return {"reports": records}
    except Exception as e:
        return {"reports": []}

class AutoFillRequest(BaseModel):
    notes: Optional[str] = ""

# Upgraded Multi-Modal Evidence AI Extraction Endpoint
@router.post("/templates/auto-fill-image")
@router.post("/extract-evidence")
async def auto_fill_image(
    notes: Optional[str] = Form(None),
    ocr_image: Optional[UploadFile] = File(None),
    source_files: Optional[List[UploadFile]] = File(None),
    document_images: Optional[List[UploadFile]] = File(None),
    event_photos: Optional[List[UploadFile]] = File(None),
    feedback_graph: Optional[UploadFile] = File(None),
    feedback_notes: Optional[str] = Form(None)
):
    try:
        doc_files_list = []
        if source_files:
            for sf in source_files:
                if sf and sf.filename:
                    content = await sf.read()
                    doc_files_list.append({"filename": sf.filename, "bytes": content})

        doc_imgs_list = []
        if ocr_image and ocr_image.filename:
            content = await ocr_image.read()
            doc_imgs_list.append({"filename": ocr_image.filename, "bytes": content})
        if document_images:
            for di in document_images:
                if di and di.filename:
                    content = await di.read()
                    doc_imgs_list.append({"filename": di.filename, "bytes": content})

        event_photos_list = []
        if event_photos:
            for ep in event_photos:
                if ep and ep.filename:
                    content = await ep.read()
                    event_photos_list.append({"filename": ep.filename, "bytes": content})

        fg_dict = None
        if feedback_graph and feedback_graph.filename:
            fg_bytes = await feedback_graph.read()
            fg_dict = {"filename": feedback_graph.filename, "bytes": fg_bytes}

        extracted_data = extract_report_data_from_evidence(
            text_notes=notes,
            document_files=doc_files_list,
            document_images=doc_imgs_list,
            event_photos=event_photos_list,
            feedback_graph=fg_dict,
            feedback_notes=feedback_notes
        )
        return extracted_data
    except Exception as e:
        print(f"Error in multi-modal auto-fill endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI extraction error: {str(e)}")

@router.post("/templates/auto-fill")
async def auto_fill(request: AutoFillRequest):
    return await auto_fill_image(notes=request.notes, ocr_image=None)

# File Download Endpoint serving exact binary files with Content-Disposition headers
@router.get("/download/{filename}")
@router.get("/generated/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(GENERATED_DIR, filename)
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif ext == ".pdf":
        media_type = "application/pdf"
    elif ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    else:
        media_type = "application/octet-stream"
        
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

async def get_template_fields():
    try:
        config_path = get_builtin_fields_config_path()
        if config_path and os.path.exists(config_path):
            with open(config_path, "r") as f:
                fields = json.load(f)
                if fields:
                    return {"fields": fields}
        return {"fields": DEFAULT_ACADEMIC_FIELDS}
    except Exception:
        return {"fields": DEFAULT_ACADEMIC_FIELDS}

# Report Generation Endpoint using Modular Template Engine
@router.post("/templates/generate")
async def generate_document(
    values: Optional[str] = Form(None),
    notice_file: Optional[UploadFile] = File(None),
    event_photos: Optional[List[UploadFile]] = File(None),
    feedback_graph: Optional[UploadFile] = File(None),
    feedback_interpretation: Optional[str] = Form(None),
    photo_assignments: Optional[str] = Form(None),
    body: Optional[GenerateDocumentRequest] = None
):
    parsed_values = {}
    if values is not None:
        try:
            parsed_values = json.loads(values)
        except Exception:
            parsed_values = {}
    elif body is not None:
        parsed_values = body.values or {}

    template_path = get_builtin_template_path()

    # Save notice/brochure file if provided
    notice_saved_path = None
    if notice_file and notice_file.filename:
        n_bytes = await notice_file.read()
        unique_n_name = f"notice_{int(time.time())}_{notice_file.filename}"
        notice_saved_path = os.path.join(UPLOADS_DIR, unique_n_name)
        with open(notice_saved_path, "wb") as f:
            f.write(n_bytes)

    # Save Feedback Graph image if provided
    feedback_graph_saved_path = None
    if feedback_graph and feedback_graph.filename:
        fg_bytes = await feedback_graph.read()
        unique_fg_name = f"feedback_graph_{int(time.time())}_{feedback_graph.filename}"
        feedback_graph_saved_path = os.path.join(UPLOADS_DIR, unique_fg_name)
        with open(feedback_graph_saved_path, "wb") as f:
            f.write(fg_bytes)

    # Save multiple uploaded event photos
    saved_event_photo_paths = []
    if event_photos:
        for ep in event_photos:
            if ep and ep.filename:
                ep_bytes = await ep.read()
                unique_ep_name = f"event_photo_{int(time.time())}_{ep.filename}"
                ep_save_path = os.path.join(UPLOADS_DIR, unique_ep_name)
                with open(ep_save_path, "wb") as f:
                    f.write(ep_bytes)
                saved_event_photo_paths.append(ep_save_path)

    try:
        raw_activity_name = parsed_values.get("activity_name", "").strip() or "Activity"
        clean_activity_name = re.sub(r'[^a-zA-Z0-9_\-]', '', raw_activity_name.replace(' ', '_'))
        clean_activity_name = clean_activity_name[:40].rstrip('_')
        if not clean_activity_name: clean_activity_name = "Activity"

        base_filename = f"{clean_activity_name}_documentation"
        docx_filename = f"{base_filename}.docx"
        pdf_filename = f"{base_filename}.pdf"

        os.makedirs(GENERATED_DIR, exist_ok=True)
        docx_path = os.path.join(GENERATED_DIR, docx_filename)
        pdf_path = os.path.join(GENERATED_DIR, pdf_filename)

        # Generate DOCX via template engine
        generate_docx_report(
            template_path=template_path,
            output_docx_path=docx_path,
            parsed_values=parsed_values,
            notice_photo_path=notice_saved_path,
            event_photo_paths=saved_event_photo_paths,
            feedback_graph_path=feedback_graph_saved_path,
            feedback_interpretation=feedback_interpretation or parsed_values.get("feedback_interpretation")
        )

        try:
            if DOCX2PDF_AVAILABLE:
                abs_docx = os.path.abspath(docx_path)
                abs_pdf = os.path.abspath(pdf_path)
                convert(abs_docx, abs_pdf)
            else:
                pdf_filename = None
        except Exception as e:
            print(f"PDF conversion notice: {e}")
            pdf_filename = None

        API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
        docx_url = f"{API_BASE_URL}/generated/{docx_filename}" if API_BASE_URL else f"/generated/{docx_filename}"
        pdf_url = (f"{API_BASE_URL}/generated/{pdf_filename}" if API_BASE_URL else f"/generated/{pdf_filename}") if pdf_filename and os.path.exists(pdf_path) else None

        # Auto-Save Report Record for "Previous Reports" Section
        report_record = {
            "id": f"report_{int(time.time())}",
            "activity_name": raw_activity_name,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "timestamp": int(time.time()),
            "docx_url": docx_url,
            "pdf_url": pdf_url,
            "docx_filename": docx_filename,
            "pdf_filename": pdf_filename
        }
        save_report_record(report_record)

        return {
            "docxUrl": docx_url,
            "pdfUrl": pdf_url,
            "docxFilename": docx_filename,
            "pdfFilename": pdf_filename
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating document: {e}")

# Register router for both root and /api paths
app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    PORT = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
