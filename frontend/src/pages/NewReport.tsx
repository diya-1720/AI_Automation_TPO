import React, { useState, useEffect, useRef } from 'react';
import { Loader2, FileDown, Download, Upload, Sparkles, Check, X as XIcon, Minus, FileText, Images, Trash2, BarChart2, FileCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Field {
  name: string;
  label: string;
  type: string;
  originalText: string;
}

// Fixed list of checklist fields for consolidation
const CHECKLIST_ITEMS = [
  { key: 'notice_brochure_tick', label: 'Notice & Brochure' },
  { key: 'attendance_list_tick', label: 'Attendance List' },
  { key: 'photos_tick', label: 'Event Photographs' },
  { key: 'certificate_tick', label: 'Certificates' },
  { key: 'feedback_form_tick', label: 'Feedback Form' },
  { key: 'feedback_analysis_tick', label: 'Feedback Analysis' },
  { key: 'news_letter_data_tick', label: 'Newsletter Data' },
  { key: 'media_news_details_tick', label: 'Media & News Details' },
  { key: 'co_po_mapping_tick', label: 'CO-PO Mapping' },
  { key: 'any_other_tick', label: 'Any Other Document' },
];

const DEFAULT_FIELDS: Field[] = [
  { name: "activity_name", label: "Name of the Activity", type: "text", originalText: "" },
  { name: "date_time", label: "Date & Time", type: "text", originalText: "" },
  { name: "venue", label: "Venue / Location", type: "text", originalText: "" },
  { name: "department", label: "Department / Organised By", type: "text", originalText: "" },
  { name: "activity_incharge", label: "Activity Incharge / Convener", type: "text", originalText: "" },
  { name: "activity_coordinator", label: "Activity Coordinator", type: "text", originalText: "" },
  { name: "resource_person", label: "Resource Person / Guest Speaker", type: "text", originalText: "" },
  { name: "nature_of_activity", label: "Nature of Activity", type: "text", originalText: "" },
  { name: "mode_of_activity", label: "Mode of Activity", type: "text", originalText: "" },
  { name: "participants", label: "Target Audience / Number of Participants", type: "text", originalText: "" },
  { name: "objectives", label: "Objectives of the Activity", type: "textarea", originalText: "" },
  { name: "target_audience", label: "Target Audience", type: "text", originalText: "" },
  { name: "event_schedule", label: "Event Schedule / Timeline", type: "textarea", originalText: "" },
  { name: "methodology", label: "Methodology & Execution Process", type: "textarea", originalText: "" },
  { name: "students_selected", label: "Students Selected / Placed", type: "textarea", originalText: "" },
  { name: "outcomes", label: "Outcomes & Key Takeaways", type: "textarea", originalText: "" },
  { name: "activity_summary", label: "Brief Event Description / Summary", type: "textarea", originalText: "" },
  { name: "strengths", label: "Strengths (SWOT)", type: "textarea", originalText: "" },
  { name: "weaknesses", label: "Weaknesses (SWOT)", type: "textarea", originalText: "" },
  { name: "opportunities", label: "Opportunities (SWOT)", type: "textarea", originalText: "" },
  { name: "threats", label: "Threats (SWOT)", type: "textarea", originalText: "" },
  { name: "feedback_summary", label: "Feedback Summary", type: "textarea", originalText: "" },
  { name: "feedback_interpretation", label: "Feedback Graph AI Interpretation", type: "textarea", originalText: "" }
];

export default function NewReport() {
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<{ docxUrl: string, pdfUrl: string | null, docxFilename?: string, pdfFilename?: string | null } | null>(null);
  
  // 1. Source Material & Notes Upload State
  const [notes, setNotes] = useState('');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const sourceFilesInputRef = useRef<HTMLInputElement>(null);

  // 2. Official Documents (Notice / Brochure / Circular) Upload State
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [noticePreviewUrl, setNoticePreviewUrl] = useState<string | null>(null);
  const noticeInputRef = useRef<HTMLInputElement>(null);

  // 3. Event Photos Section (Multiple Uploads & Grid Layout)
  const [eventPhotos, setEventPhotos] = useState<File[]>([]);
  const eventPhotosInputRef = useRef<HTMLInputElement>(null);

  // 4. Feedback Analysis Section Upload State
  const [feedbackGraph, setFeedbackGraph] = useState<File | null>(null);
  const [feedbackGraphPreviewUrl, setFeedbackGraphPreviewUrl] = useState<string | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const feedbackGraphInputRef = useRef<HTMLInputElement>(null);

  const [isAutofilling, setIsAutofilling] = useState(false);

  useEffect(() => {
    fetchFieldsAndSettings();
  }, []);

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const fetchFieldsAndSettings = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/templates/fields`);
      if (response.ok) {
        const data = await response.json();
        if (data.fields && data.fields.length > 0) {
          setFields(data.fields);
        }
      }

      // Load settings for auto-fill defaults
      const settingsRes = await fetchWithTimeout(`${API_BASE_URL}/api/settings`);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setValues(prev => ({
          college_name: settingsData.default_college_name || prev.college_name || '',
          department: settingsData.default_department || prev.department || '',
          organizer: settingsData.default_organizer || prev.organizer || '',
          activity_incharge: settingsData.default_organizer || prev.activity_incharge || '',
          venue: settingsData.default_venue || prev.venue || '',
          ...prev
        }));
      }
    } catch (err) {
      console.log('Using default template fields fallback due to timeout or network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  // Handle 3-state checklist toggle (✔ Tick, ✖ Wrong, Blank)
  const handleChecklistToggle = (key: string, targetState: '[✓]' | '[✗]' | '') => {
    setValues(prev => ({
      ...prev,
      [key]: prev[key] === targetState ? '' : targetState
    }));
  };

  // Unified Multi-Modal AI Extraction
  const handleAutoFillAllEvidence = async () => {
    const hasAnyEvidence = notes.trim() || sourceFiles.length > 0 || noticeFile || eventPhotos.length > 0 || feedbackGraph || feedbackNotes.trim();
    
    if (!hasAnyEvidence) {
      setError('Please provide notes, documents, notice image, or photos before running AI extraction.');
      return;
    }
    
    setIsAutofilling(true);
    setError(null);

    const formData = new FormData();
    if (notes.trim()) formData.append('notes', notes);
    if (feedbackNotes.trim()) formData.append('feedback_notes', feedbackNotes);

    sourceFiles.forEach(f => formData.append('source_files', f));
    if (noticeFile) formData.append('document_images', noticeFile);
    eventPhotos.forEach(p => formData.append('event_photos', p));
    if (feedbackGraph) formData.append('feedback_graph', feedbackGraph);

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/auto-fill-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to analyze evidence');
      }

      const data = await response.json();
      
      const newValues = { ...values };
      const currentFields = [...fields];

      Object.keys(data).forEach(key => {
        const val = data[key];
        const formattedVal = Array.isArray(val) 
          ? val.map(item => typeof item === 'string' && item.startsWith('•') ? item : `• ${item}`).join('\n') 
          : (val || '');
        
        newValues[key] = formattedVal;

        // Dynamically add field to UI form list if not already present
        if (!currentFields.some(f => f.name.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
          const isLongText = ['objectives', 'methodology', 'outcomes', 'activity_summary', 'strengths', 'weaknesses', 'opportunities', 'threats', 'feedback_summary', 'feedback_interpretation'].includes(key.toLowerCase());
          currentFields.push({
            name: key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: isLongText ? 'textarea' : 'text',
            originalText: key
          });
        }
      });

      setFields(currentFields);
      setValues(newValues);
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI evidence extraction');
    } finally {
      setIsAutofilling(false);
    }
  };

  // Handle Source Material file select
  const handleAddSourceFiles = (files: FileList | null) => {
    if (files) {
      setSourceFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  // Handle Notice/Brochure file select
  const handleNoticeSelect = (file: File | null) => {
    if (file) {
      setNoticeFile(file);
      if (file.type.startsWith('image/')) {
        setNoticePreviewUrl(URL.createObjectURL(file));
      } else {
        setNoticePreviewUrl(null);
      }
    }
  };

  // Handle Feedback Graph image select
  const handleFeedbackGraphSelect = (file: File | null) => {
    if (file) {
      setFeedbackGraph(file);
      if (file.type.startsWith('image/')) {
        setFeedbackGraphPreviewUrl(URL.createObjectURL(file));
      } else {
        setFeedbackGraphPreviewUrl(null);
      }
    }
  };

  // Handle Event Photos multiple file select
  const handleAddEventPhotos = (files: FileList | null) => {
    if (files) {
      setEventPhotos(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveEventPhoto = (index: number) => {
    setEventPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setGeneratedFiles(null);

    const formData = new FormData();
    formData.append('values', JSON.stringify(values));
    
    if (noticeFile) {
      formData.append('notice_file', noticeFile);
    }
    if (feedbackGraph) {
      formData.append('feedback_graph', feedbackGraph);
    }
    if (values.feedback_interpretation) {
      formData.append('feedback_interpretation', values.feedback_interpretation);
    }
    eventPhotos.forEach(photo => {
      formData.append('event_photos', photo);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/generate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to generate document');
      }

      const data = await response.json();
      setGeneratedFiles(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the document');
    } finally {
      setIsGenerating(false);
    }
  };

  const getFullUrl = (urlStr?: string | null) => {
    if (!urlStr) return '';
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) return urlStr;
    return `${API_BASE_URL}${urlStr.startsWith('/') ? '' : '/'}${urlStr}`;
  };

  const handleDownloadFile = async (urlStr: string, defaultFilename: string) => {
    try {
      const targetUrl = getFullUrl(urlStr);
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error('Failed to download file');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Blob download fallback:', err);
      window.open(getFullUrl(urlStr), '_blank');
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
  }

  // Filter out checklist items from normal dynamic text inputs
  const checklistKeys = CHECKLIST_ITEMS.map(item => item.key);
  const standardFields = fields.filter(f => !checklistKeys.includes(f.name));

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="border-b dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Generate New Report</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Upload your available evidence (notes, notices, brochures, photos, feedback charts). AI will extract and map factual information into your official report format.
        </p>
      </div>

      {/* 1. Source Material & Notes Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-indigo-400" /> 1. Source Material & Notes
          </h2>
          <span className="text-xs bg-blue-50 dark:bg-indigo-900/50 text-blue-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
            Notes / PDF / DOCX / TXT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <textarea
            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            rows={4}
            placeholder="Paste raw transcript, meeting notes, session summary, or rough details here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div
            onClick={() => sourceFilesInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-blue-50/50 transition text-center"
          >
            <Upload className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Upload Document Files
            </p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">Supports PDF, DOCX, TXT files</p>
            <input
              type="file"
              multiple
              ref={sourceFilesInputRef}
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleAddSourceFiles(e.target.files)}
            />
          </div>
        </div>

        {sourceFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {sourceFiles.map((sf, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-indigo-800/50 rounded-lg text-xs font-medium text-blue-900 dark:text-indigo-300">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate max-w-[200px]">{sf.name}</span>
                <button onClick={() => setSourceFiles(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 ml-1">
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Notice & Brochure Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 2. Official Documents (Notice / Brochure / Circular)
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload event notice, brochure flyer, circular, or certificate. AI will extract official dates, speaker details, and venue, and embed the document as proof into the report.
        </p>

        <div
          onClick={() => noticeInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-indigo-50/50 transition text-center"
        >
          <Upload className="w-8 h-8 text-indigo-500 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            {noticeFile ? noticeFile.name : 'Click or drop Notice & Brochure file here'}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Supports JPG, PNG, or PDF format</p>
          <input
            type="file"
            ref={noticeInputRef}
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) => e.target.files && handleNoticeSelect(e.target.files[0])}
          />
        </div>

        {noticeFile && (
          <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              {noticePreviewUrl && (
                <img src={noticePreviewUrl} alt="Notice Preview" className="w-12 h-12 object-cover rounded-lg border dark:border-slate-700" />
              )}
              <div>
                <p className="font-semibold text-indigo-900 dark:text-indigo-200">{noticeFile.name}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Informational document ready for OCR & DOCX embedding</p>
              </div>
            </div>
            <button
              onClick={() => { setNoticeFile(null); setNoticePreviewUrl(null); }}
              className="text-red-600 dark:text-red-400 hover:underline font-medium px-2 py-1"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* 3. Event Photographs Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Images className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> 3. Event Photographs (Evidence)
          </h2>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-medium">
            2-Column Evidence Grid
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload event photographs (students attending, speaker delivering session, group photos). They will be formatted into a neat 2-column evidence section in the report.
        </p>

        <div
          onClick={() => eventPhotosInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-emerald-50/50 transition text-center"
        >
          <Images className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Click to upload Event Photographs
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Select multiple photos (JPG, PNG)</p>
          <input
            type="file"
            multiple
            ref={eventPhotosInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => handleAddEventPhotos(e.target.files)}
          />
        </div>

        {eventPhotos.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Uploaded Event Photos ({eventPhotos.length})
              </span>
              <button
                onClick={() => setEventPhotos([])}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Clear All Photos
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eventPhotos.map((photo, idx) => (
                <div key={idx} className="relative group bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2 flex flex-col items-center">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Event Photo ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                  <p className="text-[11px] font-medium text-gray-800 dark:text-slate-200 truncate w-full text-center">
                    {photo.name}
                  </p>
                  <button
                    onClick={() => handleRemoveEventPhoto(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 transition shadow"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Feedback Analysis Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" /> 4. Feedback Analysis & Graph Chart
          </h2>
          <span className="text-xs bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full font-medium">
            Feedback Graph + AI Summary
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload a feedback graph/chart image. AI will analyze the graph visuals and write a short factual interpretation underneath it in the report.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => feedbackGraphInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-purple-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-purple-50/50 transition text-center"
          >
            <BarChart2 className="w-8 h-8 text-purple-500 mb-2" />
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {feedbackGraph ? feedbackGraph.name : 'Upload Feedback Graph / Chart Image'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">Supports PNG, JPG, PDF</p>
            <input
              type="file"
              ref={feedbackGraphInputRef}
              className="hidden"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => e.target.files && handleFeedbackGraphSelect(e.target.files[0])}
            />
          </div>

          <textarea
            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            rows={4}
            placeholder="Optional manual feedback notes or survey remarks..."
            value={feedbackNotes}
            onChange={(e) => setFeedbackNotes(e.target.value)}
          />
        </div>

        {feedbackGraph && (
          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-800/50 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              {feedbackGraphPreviewUrl && (
                <img src={feedbackGraphPreviewUrl} alt="Feedback Chart" className="w-12 h-12 object-cover rounded-lg border dark:border-slate-700" />
              )}
              <div>
                <p className="font-semibold text-purple-900 dark:text-purple-200">{feedbackGraph.name}</p>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Ready for Feedback Analysis section insertion</p>
              </div>
            </div>
            <button
              onClick={() => { setFeedbackGraph(null); setFeedbackGraphPreviewUrl(null); }}
              className="text-red-600 dark:text-red-400 hover:underline font-medium px-2 py-1"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Action Bar: Run AI Multi-Modal Extraction */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleAutoFillAllEvidence}
          disabled={isAutofilling}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-50 transition text-sm cursor-pointer"
        >
          {isAutofilling ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AI Analyzing Evidence Set...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Extract & Auto-Fill Form with AI
            </>
          )}
        </button>
      </div>

      {/* 5. Checklist Box */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b dark:border-slate-700 pb-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Checklist Proofs Attached</h2>
          <span className="text-xs text-gray-500 dark:text-slate-400">Select status for each annexure / document</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHECKLIST_ITEMS.map((item) => {
            const currentState = values[item.key] || '';
            return (
              <div key={item.key} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl">
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
                
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 border dark:border-slate-700 rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleChecklistToggle(item.key, '[✓]')}
                    title="Tick (Present)"
                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                      currentState === '[✓]'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> Tick
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChecklistToggle(item.key, '[✗]')}
                    title="Wrong (Not Attached)"
                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                      currentState === '[✗]'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-700'
                    }`}
                  >
                    <XIcon className="w-3.5 h-3.5" /> Wrong
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange(item.key, '')}
                    title="Blank (Leave empty)"
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      currentState === ''
                        ? 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white font-semibold'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> Blank
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Form Fields Grid */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="border-b dark:border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Event Report Fields</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Fields populated by AI evidence extraction. Leave empty fields blank if not supported by evidence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {standardFields.map((field, index) => (
              <div key={index} className={`flex flex-col space-y-1 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                <label className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    rows={3}
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder="Optional or empty if not in evidence..."
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder="Optional or empty if not in evidence..."
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-700/50 text-sm">
              {error}
            </div>
          )}

          <div className="pt-4 flex items-center justify-end border-t border-gray-200 dark:border-slate-700">
            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
              Generate Document
            </button>
          </div>
        </form>
      </div>

      {/* 7. Generation Results Bar */}
      {generatedFiles && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-700/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-300">Generation Successful!</h2>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-full font-semibold">
              Auto-saved to Previous Reports
            </span>
          </div>

          <div className="flex gap-4">
            {generatedFiles.docxUrl && (
              <button
                type="button"
                onClick={() => handleDownloadFile(generatedFiles.docxUrl, generatedFiles.docxFilename || 'report.docx')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl font-medium hover:bg-emerald-100 dark:hover:bg-slate-700 transition shadow-xs text-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download DOCX
              </button>
            )}
            {generatedFiles.pdfUrl && (
              <button
                type="button"
                onClick={() => generatedFiles.pdfUrl && handleDownloadFile(generatedFiles.pdfUrl, generatedFiles.pdfFilename || 'report.pdf')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-slate-700 transition shadow-xs text-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
