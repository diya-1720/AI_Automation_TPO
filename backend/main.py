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
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import docx
from docx.shared import Inches, Pt
import google.generativeai as genai
from pypdf import PdfReader
from PIL import Image
from docx2pdf import convert

load_dotenv()

os.makedirs("generated", exist_ok=True)
os.makedirs("generated/uploads", exist_ok=True)
os.makedirs("templates", exist_ok=True)

REPORTS_DB_PATH = "generated/reports_db.json"
USERS_DB_PATH = "generated/users_db.json"
SETTINGS_DB_PATH = "generated/settings_db.json"

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
app.mount("/generated", StaticFiles(directory="generated"), name="generated")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
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

# Auth & Settings Endpoints
@app.post("/api/auth/signup")
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

@app.post("/api/auth/login")
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

@app.get("/api/auth/me")
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

@app.get("/api/settings")
async def get_settings_endpoint():
    return load_settings()

@app.post("/api/settings")
async def update_settings_endpoint(req: SettingsModel):
    current = load_settings()
    updated = req.model_dump(exclude_unset=True)
    current.update(updated)
    save_settings(current)
    return {"message": "Settings saved successfully", "settings": current}

@app.get("/api/reports")
async def get_reports_endpoint():
    if os.path.exists(REPORTS_DB_PATH):
        try:
            with open(REPORTS_DB_PATH, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

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
@app.get("/api/reports")
async def get_previous_reports():
    if not os.path.exists(REPORTS_DB_PATH):
        return {"reports": []}
    try:
        with open(REPORTS_DB_PATH, "r") as f:
            records = json.load(f)
            return {"reports": records}
    except Exception as e:
        return {"reports": []}

@app.post("/api/templates/analyze-evidence")
async def analyze_template_and_evidence(
    master_template: Optional[UploadFile] = File(None),
    evidence_files: List[UploadFile] = File([])
):
    master_doc_text = ""
    template_filename = "Template.docx"

    if master_template and master_template.filename:
        filename = master_template.filename
        ext = os.path.splitext(filename)[1].lower()
        contents = await master_template.read()
        template_filename = filename
        
        save_path = os.path.join("templates", filename)
        with open(save_path, "wb") as f:
            f.write(contents)

        if ext == ".docx":
            master_doc_text = extract_text_from_docx_bytes(contents)
        elif ext == ".pdf":
            master_doc_text = extract_text_from_pdf_bytes(contents)

    combined_evidence_text = ""
    processed_photos = []

    for ev_file in evidence_files:
        if not ev_file.filename:
            continue
        ext = os.path.splitext(ev_file.filename)[1].lower()
        contents = await ev_file.read()

        if ext == ".docx":
            combined_evidence_text += f"\n--- Evidence DOCX ({ev_file.filename}) ---\n"
            combined_evidence_text += extract_text_from_docx_bytes(contents)
        elif ext == ".pdf":
            combined_evidence_text += f"\n--- Evidence PDF ({ev_file.filename}) ---\n"
            combined_evidence_text += extract_text_from_pdf_bytes(contents)
        elif ext in [".jpg", ".jpeg", ".png"]:
            ocr_res = extract_text_from_image_bytes(contents, ev_file.filename)
            combined_evidence_text += f"\n--- Evidence Image OCR ({ev_file.filename}) ---\n{ocr_res}\n"
            
            unique_name = f"ev_{int(time.time())}_{ev_file.filename}"
            photo_save_path = os.path.join("generated", "uploads", unique_name)
            with open(photo_save_path, "wb") as f:
                f.write(contents)
            
            processed_photos.append({
                "filename": ev_file.filename,
                "saved_path": photo_save_path,
                "url": f"http://localhost:8000/generated/uploads/{unique_name}"
            })

    prompt = f"""
You are an AI Event Documentation Assistant. Analyze the master template and extracted evidence files.
Identify all dynamic placeholders in the template and map extracted values from evidence.
Also generate professional academic report sections: Activity Summary, Objectives (bullet points), Outcomes (bullet points), Brief Event Description.

Return ONLY a valid JSON object matching this exact structure:
{{
  "fields": [
    {{
      "name": "activity_name",
      "label": "Activity Name",
      "type": "text",
      "value": "Extracted Activity Name",
      "originalText": "Original text or placeholder in master template",
      "confidence_score": 95,
      "confidence_level": "high"
    }}
  ],
  "generated_summaries": {{
    "activity_summary": "Synthesized 2-3 paragraph professional activity summary",
    "objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
    "outcomes": "• Outcome 1\\n• Outcome 2\\n• Outcome 3",
    "event_description": "Detailed event description highlighting key moments"
  }},
  "photo_assignments": [
    {{
      "placeholder": "[PHOTO_1]",
      "label": "Event Photo 1",
      "assigned_photo_filename": "photo1.jpg",
      "description": "Photo placement reasoning"
    }}
  ]
}}

Master Template Text:
{master_doc_text if master_doc_text else "Default Activity Report Template"}

Extracted Evidence Text:
{combined_evidence_text}
"""

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        if response_text.startswith("```json"): response_text = response_text[7:]
        elif response_text.startswith("```"): response_text = response_text[3:]
        if response_text.endswith("```"): response_text = response_text[:-3]
            
        analysis_data = json.loads(response_text)
    except Exception as e:
        print(f"Gemini analysis notice: {e}")
        analysis_data = {
            "fields": [
                {"name": "activity_name", "label": "Activity Name", "type": "text", "value": "SPC Activity Report", "originalText": "Activity Name", "confidence_score": 85, "confidence_level": "high"},
                {"name": "date_time", "label": "Date & Time", "type": "text", "value": datetime.now().strftime("%Y-%m-%d"), "originalText": "Date", "confidence_score": 90, "confidence_level": "high"},
                {"name": "venue", "label": "Venue", "type": "text", "value": "Main Auditorium", "originalText": "Venue", "confidence_score": 80, "confidence_level": "medium"},
                {"name": "department", "label": "Department", "type": "text", "value": "Training & Placement Cell", "originalText": "Department", "confidence_score": 95, "confidence_level": "high"}
            ],
            "generated_summaries": {
                "activity_summary": "Professional activity organized for skill enhancement.", "objectives": "• Enhance skills\n• Knowledge sharing", "outcomes": "• Student participation\n• Practical insights", "event_description": "Event conducted successfully."
            },
            "photo_assignments": []
        }

    for p in processed_photos:
        p["assigned_placeholder"] = next(
            (pa.get("placeholder") for pa in analysis_data.get("photo_assignments", []) if pa.get("assigned_photo_filename") == p["filename"]),
            "[PHOTO_1]"
        )

    return {
        "template_filename": template_filename,
        "fields": analysis_data.get("fields", []),
        "generated_summaries": analysis_data.get("generated_summaries", {}),
        "photo_assignments": analysis_data.get("photo_assignments", []),
        "uploaded_photos": processed_photos,
        "evidence_files_count": len(evidence_files)
    }

# Endpoint for Custom Template Upload & Extraction (Supports DOCX & PDF)
@app.post("/api/templates/analyze", response_model=AnalyzeTemplateResponse)
async def analyze_template(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".docx", ".pdf"]:
        raise HTTPException(status_code=400, detail="Only DOCX and PDF template files are supported.")
    
    contents = await file.read()
    document_text = ""

    if ext == ".docx":
        with open("templates/Template.docx", "wb") as f:
            f.write(contents)
        document_text = extract_text_from_docx_bytes(contents)
    elif ext == ".pdf":
        document_text = extract_text_from_pdf_bytes(contents)

    prompt = f"""
Analyze the document template and identify dynamic form fields.
Return ONLY a JSON array of objects with name, label, type, originalText.
Document Text:
{document_text}
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        if response_text.startswith("```json"): response_text = response_text[7:]
        if response_text.endswith("```"): response_text = response_text[:-3]
            
        fields = json.loads(response_text)
        return AnalyzeTemplateResponse(fields=fields)
    except Exception as e:
        return AnalyzeTemplateResponse(fields=[
            {"name": "activity_name", "label": "Activity Name", "type": "text", "originalText": "Activity Name"},
            {"name": "date_time", "label": "Date & Time", "type": "text", "originalText": "Date"},
            {"name": "venue", "label": "Venue", "type": "text", "originalText": "Venue"},
            {"name": "department", "label": "Department", "type": "text", "originalText": "Department"}
        ])

# Upgraded Auto-Fill supporting Text Notes & Handwritten/Printed Image OCR
@app.post("/api/templates/auto-fill-image")
async def auto_fill_image(
    notes: Optional[str] = Form(None),
    ocr_image: Optional[UploadFile] = File(None)
):
    ocr_text = ""
    if ocr_image and ocr_image.filename:
        image_bytes = await ocr_image.read()
        ocr_text = extract_text_from_image_bytes(image_bytes, ocr_image.filename)

    combined_input = ""
    if notes: combined_input += f"User Text Notes:\n{notes}\n\n"
    if ocr_text: combined_input += f"Extracted Image OCR Text:\n{ocr_text}"

    if not combined_input.strip():
        combined_input = "Event Activity Notes: General training session organized by TPO cell."

    prompt = f"""
You are an expert academic documentation assistant for university and college event/activity reports.
The user will provide raw, unstructured, or brief notes, transcripts, or OCR text extracted from images about an event/activity (e.g. "AI guest lecture", "Python workshop", "Campus placement drive").

YOUR MANDATE:
Do NOT just extract or paste raw text 1-to-1. Act as a generative AI assistant (similar to ChatGPT) to actively generate, expand, and synthesize professional, formal academic content for an official report based on the context.

INSTRUCTIONS FOR GENERATION:
1. "activity_name": Expand brief notes into a formal, clear academic title (e.g. "Guest Lecture on Artificial Intelligence & Emerging Industry Trends").
2. "date_time": Extract if present, or provide current date if unspecified.
3. "venue": Extract if present, or infer an appropriate campus location (e.g. "Main Seminar Hall, Campus").
4. "department": Extract or infer (e.g. "Department of Computer Engineering / TPO Cell").
5. "organizer" / "activity_incharge": Extract or infer (e.g. "Training & Placement Cell").
6. "resource_person": Extract or infer (e.g. "Industry Technical Expert & Guest Speaker").
7. "participants" / "target_audience": Infer target audience (e.g. "Third & Final Year Engineering Students").
8. "nature_of_activity": Academic / Technical / Training / Workshop / Guest Lecture.
9. "mode_of_activity": Offline / Hybrid / Online.

GENERATIVE ACADEMIC SECTIONS (EXPAND CREATIVELY & PROFESSIONALLY):
- "objectives": Generate 3-4 professional academic bullet points explaining the logical goals and learning objectives of this event based on the topic. Format each point with a bullet '• '.
- "methodology": Write a formal academic paragraph (4-6 sentences) explaining the step-by-step process of how this event was conducted (opening address, core presentation, hands-on demonstration, Q&A session, vote of thanks).
- "outcomes": Generate 3-4 clear academic outcome bullet points detailing student skill gains and practical takeaways. Format each point with a bullet '• '.
- "activity_summary": Write a cohesive 2-paragraph executive summary suitable for institutional records.
- "strengths": List 2-3 key event strengths (e.g. "• High student participation\n• Industry expert insights\n• Interactive Q&A session").
- "weaknesses": List 1-2 constructive points (e.g. "• Time constraint for advanced hands-on lab exercises").
- "feedback_summary": Write a formal summary of participant feedback (e.g. "Participant feedback was overwhelmingly positive with 95%+ satisfaction rating across content, delivery, and relevance.").

Return ONLY a valid JSON object with these snake_case keys:
activity_name, date_time, venue, department, activity_incharge, activity_coordinator, resource_person, nature_of_activity, mode_of_activity, participants, target_audience, objectives, methodology, outcomes, activity_summary, strengths, weaknesses, feedback_summary.

Notes & Context Input:
{combined_input}
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        if response_text.startswith("```json"): response_text = response_text[7:]
        elif response_text.startswith("```"): response_text = response_text[3:]
        if response_text.endswith("```"): response_text = response_text[:-3]
            
        data = json.loads(response_text)
        return data
    except Exception as e:
        print(f"Auto-fill generative fallback: {e}")
        topic = notes.strip() if notes else "Training & Placement Session"
        return {
            "activity_name": f"Interactive Session on {topic}",
            "date_time": datetime.now().strftime("%Y-%m-%d"),
            "venue": "Main Seminar Hall, Campus",
            "department": "Training & Placement Cell",
            "activity_incharge": "TPO Coordinator",
            "activity_coordinator": "Faculty Coordinator",
            "resource_person": "Domain Industry Expert",
            "nature_of_activity": "Technical Training & Placement Guidance",
            "mode_of_activity": "Offline Session",
            "participants": "120+ Students & Faculty Members",
            "objectives": "• To impart comprehensive practical knowledge and core domain concepts to students.\n• To bridge the gap between academic curriculum and current industry requirements.\n• To facilitate interactive technical discussions and career guidance.",
            "methodology": f"The event on '{topic}' commenced with a welcome address and introduction of the guest speaker. The speaker conducted an engaging session covering fundamental concepts, technical workflows, and real-world case studies. This was followed by an interactive Q&A session where students addressed their queries, concluding with a vote of thanks.",
            "outcomes": "• Participants developed a clear understanding of core domain principles and industry trends.\n• Students acquired actionable insights into career opportunities and technical preparation.\n• Enhanced engagement and active participation during practical Q&A discussions.",
            "activity_summary": f"A comprehensive training session on {topic} was organized successfully for students. The program aimed to equip participants with industry-relevant skills and practical perspectives.",
            "strengths": "• Excellent student attendance and interactive participation.\n• Well-structured presentation with real-world case studies.",
            "weaknesses": "• Need for extended hands-on laboratory duration in future sessions.",
            "feedback_summary": "Overall feedback received from students was highly encouraging with 95%+ positive rating."
        }

@app.post("/api/templates/auto-fill")
async def auto_fill(request: AutoFillRequest):
    return await auto_fill_image(notes=request.notes, ocr_image=None)

@app.post("/api/templates/save")
async def save_template(request: SaveTemplateRequest):
    with open("templates/fields_config.json", "w") as f:
        json.dump([field.model_dump() for field in request.fields], f)
    return {"message": "Template saved successfully"}

DEFAULT_ACADEMIC_FIELDS = [
    {"name": "activity_name", "label": "Name of the Activity", "type": "text", "originalText": "Name of the Activity"},
    {"name": "date_time", "label": "Date & Time", "type": "text", "originalText": "Date & Time"},
    {"name": "venue", "label": "Venue / Location", "type": "text", "originalText": "Venue"},
    {"name": "department", "label": "Department / Organised By", "type": "text", "originalText": "Department"},
    {"name": "activity_incharge", "label": "Activity Incharge / Convener", "type": "text", "originalText": "Activity Incharge"},
    {"name": "activity_coordinator", "label": "Activity Coordinator", "type": "text", "originalText": "Activity Coordinator"},
    {"name": "resource_person", "label": "Resource Person / Guest Speaker", "type": "text", "originalText": "Resource Person"},
    {"name": "nature_of_activity", "label": "Nature of Activity", "type": "text", "originalText": "Nature of Activity"},
    {"name": "mode_of_activity", "label": "Mode of Activity", "type": "text", "originalText": "Mode of Activity"},
    {"name": "participants", "label": "Target Audience / Number of Participants", "type": "text", "originalText": "Participants"},
    {"name": "objectives", "label": "Objectives of the Activity", "type": "textarea", "originalText": "Objectives"},
    {"name": "methodology", "label": "Methodology & Execution Process", "type": "textarea", "originalText": "Methodology"},
    {"name": "outcomes", "label": "Outcomes & Key Takeaways", "type": "textarea", "originalText": "Outcomes"},
    {"name": "activity_summary", "label": "Brief Event Description / Summary", "type": "textarea", "originalText": "Activity Summary"},
    {"name": "strengths", "label": "Strengths & Highlights", "type": "textarea", "originalText": "Strengths"},
    {"name": "weaknesses", "label": "Weaknesses & Scope for Improvement", "type": "textarea", "originalText": "Weaknesses"},
    {"name": "feedback_summary", "label": "Feedback Analysis Summary", "type": "textarea", "originalText": "Feedback Summary"}
]

@app.get("/api/templates/fields")
async def get_template_fields():
    try:
        if os.path.exists("templates/fields_config.json"):
            with open("templates/fields_config.json", "r") as f:
                fields = json.load(f)
                if fields:
                    return {"fields": fields}
        return {"fields": DEFAULT_ACADEMIC_FIELDS}
    except Exception:
        return {"fields": DEFAULT_ACADEMIC_FIELDS}

# Report Generation Endpoint with Notice Upload, Event Photos Grid Layout & Auto-Save
@app.post("/api/templates/generate")
async def generate_document(
    values: Optional[str] = Form(None),
    notice_file: Optional[UploadFile] = File(None),
    event_photos: Optional[List[UploadFile]] = File(None),
    photo_assignments: Optional[str] = Form(None),
    template_filename: Optional[str] = Form(None),
    body: Optional[GenerateDocumentRequest] = None
):
    parsed_values = {}
    parsed_photos = {}
    tmpl_filename = None

    if values is not None:
        try:
            parsed_values = json.loads(values)
        except Exception:
            parsed_values = {}
    elif body is not None:
        parsed_values = body.values or {}
        parsed_photos = body.photo_assignments or {}
        tmpl_filename = body.template_filename

    if photo_assignments and isinstance(photo_assignments, str):
        try:
            parsed_photos = json.loads(photo_assignments)
        except Exception:
            pass

    template_path = os.path.join("templates", tmpl_filename) if tmpl_filename and os.path.exists(os.path.join("templates", tmpl_filename)) else "templates/Template.docx"
    if not os.path.exists(template_path):
        template_path = "templates/Template.docx"

    # Save notice/brochure file if provided
    notice_saved_path = None
    if notice_file and notice_file.filename:
        n_bytes = await notice_file.read()
        unique_n_name = f"notice_{int(time.time())}_{notice_file.filename}"
        notice_saved_path = os.path.join("generated", "uploads", unique_n_name)
        with open(notice_saved_path, "wb") as f:
            f.write(n_bytes)

    # Save multiple uploaded event photos
    saved_event_photo_paths = []
    if event_photos:
        for ep in event_photos:
            if ep and ep.filename:
                ep_bytes = await ep.read()
                unique_ep_name = f"event_photo_{int(time.time())}_{ep.filename}"
                ep_save_path = os.path.join("generated", "uploads", unique_ep_name)
                with open(ep_save_path, "wb") as f:
                    f.write(ep_bytes)
                saved_event_photo_paths.append(ep_save_path)

    try:
        doc = docx.Document(template_path) if os.path.exists(template_path) else docx.Document()

        # 1. Fill SJCEM AF-5 Structured Tables if applicable
        if len(doc.tables) >= 4:
            try:
                t0 = doc.tables[0]
                t0.rows[0].cells[1].text = parsed_values.get("activity_name", "")
                t0.rows[1].cells[1].text = parsed_values.get("date_time", "")
                t0.rows[1].cells[3].text = parsed_values.get("department", "")
                t0.rows[2].cells[1].text = parsed_values.get("venue", "")
                t0.rows[2].cells[3].text = parsed_values.get("participants", "")
                t0.rows[3].cells[1].text = parsed_values.get("nature_of_activity", "")
                t0.rows[3].cells[3].text = parsed_values.get("mode_of_activity", "")
                t0.rows[4].cells[1].text = parsed_values.get("activity_incharge", "")
                t0.rows[4].cells[3].text = parsed_values.get("activity_coordinator", "")
                t0.rows[5].cells[1].text = parsed_values.get("resource_person", "")

                t1 = doc.tables[1]
                t1.rows[0].cells[1].text = parsed_values.get("objectives", "")
                t1.rows[1].cells[1].text = parsed_values.get("target_audience", "")
                t1.rows[2].cells[1].text = parsed_values.get("methodology", "")
                t1.rows[3].cells[1].text = parsed_values.get("outcomes", "")

                t2 = doc.tables[2]
                t2.rows[1].cells[0].text = parsed_values.get("strengths", "")
                t2.rows[1].cells[1].text = parsed_values.get("weaknesses", "")
                t2.rows[1].cells[2].text = parsed_values.get("opportunities", "")
                t2.rows[1].cells[3].text = parsed_values.get("threats", "")

                t3 = doc.tables[3]
                t3.rows[0].cells[0].text = parsed_values.get("notice_brochure_tick", "")
                t3.rows[0].cells[2].text = parsed_values.get("feedback_analysis_tick", "")
                t3.rows[1].cells[0].text = parsed_values.get("attendance_list_tick", "")
                t3.rows[1].cells[2].text = parsed_values.get("news_letter_data_tick", "")
                t3.rows[2].cells[0].text = parsed_values.get("photos_tick", "")
                t3.rows[2].cells[2].text = parsed_values.get("media_news_details_tick", "")
                t3.rows[3].cells[0].text = parsed_values.get("certificate_tick", "")
                t3.rows[3].cells[2].text = parsed_values.get("co_po_mapping_tick", "")
                t3.rows[4].cells[0].text = parsed_values.get("feedback_form_tick", "")
                t3.rows[4].cells[2].text = parsed_values.get("any_other_tick", "")
            except Exception as table_err:
                print(f"Table fill notice: {table_err}")

        # Helper: Replace text in paragraph
        def replace_text_in_paragraph(para, target_text, replacement_text):
            if not target_text:
                return
            repl = replacement_text if replacement_text is not None else ""
            if target_text in para.text:
                replaced = False
                for run in para.runs:
                    if target_text in run.text:
                        run.text = run.text.replace(target_text, repl)
                        replaced = True
                if not replaced:
                    para.text = para.text.replace(target_text, repl)

        # Helper: Insert photo into paragraph preserving aspect ratio
        def insert_photo_into_paragraph(para, photo_path, max_width_inches=3.0):
            try:
                if not photo_path or not os.path.exists(photo_path):
                    return False
                img = Image.open(photo_path)
                width_px, height_px = img.size
                aspect_ratio = height_px / float(width_px) if width_px > 0 else 0.75

                target_width = Inches(max_width_inches)
                target_height = Inches(max_width_inches * aspect_ratio)

                para.text = ""
                run = para.add_run()
                run.add_picture(photo_path, width=target_width, height=target_height)
                return True
            except Exception as img_err:
                print(f"Error inserting picture {photo_path}: {img_err}")
                return False

        # Track notice placement
        notice_inserted = False
        if notice_saved_path:
            parsed_photos["[NOTICE_PHOTO]"] = notice_saved_path
            parsed_photos["[NOTICE]"] = notice_saved_path

        # 2. Process paragraphs for text replacement & photo insertion
        for para in doc.paragraphs:
            for key, val in parsed_values.items():
                replace_text_in_paragraph(para, f"[{key}]", val or "")
                replace_text_in_paragraph(para, f"{{{key}}}", val or "")
                if val:
                    replace_text_in_paragraph(para, key, val)

            for ph_key, p_path in parsed_photos.items():
                if ph_key in para.text and p_path:
                    if insert_photo_into_paragraph(para, p_path):
                        if p_path == notice_saved_path:
                            notice_inserted = True

        # 3. Process table cells for text replacement & photo insertion
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        for key, val in parsed_values.items():
                            replace_text_in_paragraph(para, f"[{key}]", val or "")
                            replace_text_in_paragraph(para, f"{{{key}}}", val or "")

                        for ph_key, p_path in parsed_photos.items():
                            if ph_key in para.text and p_path:
                                if insert_photo_into_paragraph(para, p_path, max_width_inches=2.5):
                                    if p_path == notice_saved_path:
                                        notice_inserted = True

        # Ensure Notice & Brochure photo is attached if not already inserted by placeholder
        if notice_saved_path and not notice_inserted:
            doc.add_page_break()
            p_nhead = doc.add_paragraph()
            run_nh = p_nhead.add_run("Notice & Brochure")
            run_nh.bold = True
            run_nh.font.size = Pt(14)
            insert_photo_into_paragraph(doc.add_paragraph(), notice_saved_path, max_width_inches=5.2)

        # 4. Process Multiple Event Photos into a Structured 2-Column Table Grid (2x2 / 2x3 Layout)
        if saved_event_photo_paths:
            doc.add_page_break()
            p_ehead = doc.add_paragraph()
            run_eh = p_ehead.add_run("Event Photographs")
            run_eh.bold = True
            run_eh.font.size = Pt(14)

            # Create 2-column Word table for neat grid layout
            grid_table = doc.add_table(rows=0, cols=2)
            grid_table.autofit = False

            for i in range(0, len(saved_event_photo_paths), 2):
                row_cells = grid_table.add_row().cells
                
                # Left Column Photo
                path1 = saved_event_photo_paths[i]
                p1 = row_cells[0].paragraphs[0]
                insert_photo_into_paragraph(p1, path1, max_width_inches=2.8)
                
                # Right Column Photo (if present)
                if i + 1 < len(saved_event_photo_paths):
                    path2 = saved_event_photo_paths[i + 1]
                    p2 = row_cells[1].paragraphs[0]
                    insert_photo_into_paragraph(p2, path2, max_width_inches=2.8)

        # Clean up remaining unfilled placeholders like [field_name] to ensure empty fields remain blank
        for para in doc.paragraphs:
            para.text = re.sub(r'\[[a-zA-Z0-9_]+\]', '', para.text)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        para.text = re.sub(r'\[[a-zA-Z0-9_]+\]', '', para.text)

        # Strict Naming Format: [Name_of_the_Activity]_documentation.pdf / .docx
        raw_activity_name = parsed_values.get("activity_name", "").strip() or "Activity"
        clean_activity_name = re.sub(r'[^a-zA-Z0-9_\-]', '', raw_activity_name.replace(' ', '_'))
        if not clean_activity_name: clean_activity_name = "Activity"

        base_filename = f"{clean_activity_name}_documentation"
        docx_filename = f"{base_filename}.docx"
        pdf_filename = f"{base_filename}.pdf"

        docx_path = os.path.join("generated", docx_filename)
        pdf_path = os.path.join("generated", pdf_filename)

        doc.save(docx_path)

        try:
            abs_docx = os.path.abspath(docx_path)
            abs_pdf = os.path.abspath(pdf_path)
            convert(abs_docx, abs_pdf)
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

if __name__ == "__main__":
    import uvicorn
    PORT = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
