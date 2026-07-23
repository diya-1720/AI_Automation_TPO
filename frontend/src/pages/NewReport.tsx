import React, { useState, useEffect, useRef } from 'react';
import { Loader2, FileDown, Download, Upload, Sparkles, Check, X as XIcon, Minus, Image as ImageIcon, FileText, Images, Trash2 } from 'lucide-react';
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

export default function NewReport() {
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<{ docxUrl: string, pdfUrl: string | null } | null>(null);
  
  // Notes & Image OCR Auto-Fill State
  const [notes, setNotes] = useState('');
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Notice & Brochure Upload State
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [noticePreviewUrl, setNoticePreviewUrl] = useState<string | null>(null);
  const noticeInputRef = useRef<HTMLInputElement>(null);

  // Event Photos Section (Multiple Uploads & Grid Layout)
  const [eventPhotos, setEventPhotos] = useState<File[]>([]);
  const eventPhotosInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFieldsAndSettings();
  }, []);

  const fetchFieldsAndSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/fields`);
      const data = await response.json();
      setFields(data.fields || []);

      // Load settings for auto-fill defaults
      const settingsRes = await fetch(`${API_BASE_URL}/api/settings`);
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
      setError('Failed to load template configuration. Have you saved a template yet?');
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

  // Image & Notes OCR Auto-Fill
  const handleAutoFillWithImage = async () => {
    if (!notes.trim() && !ocrImage) {
      setError('Please enter text notes or upload an image of handwritten/printed notes.');
      return;
    }
    setIsAutofilling(true);
    setError(null);

    const formData = new FormData();
    if (notes.trim()) formData.append('notes', notes);
    if (ocrImage) formData.append('ocr_image', ocrImage);

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/auto-fill-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to analyze notes/image');
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
          const isLongText = ['objectives', 'methodology', 'outcomes', 'activity_summary', 'strengths', 'weaknesses', 'feedback_summary'].includes(key.toLowerCase());
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
      setError(err.message || 'An error occurred during AI OCR analysis');
    } finally {
      setIsAutofilling(false);
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

  // Handle Event Photos multiple file select
  const handleAddEventPhotos = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      setEventPhotos(prev => [...prev, ...fileArray]);
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

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
  }

  if (fields.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-yellow-50 text-yellow-800 p-6 rounded-xl border border-yellow-200 shadow-xs">
          <h2 className="text-xl font-semibold mb-2">No Template Found</h2>
          <p>Please go to the Templates page, upload a template, analyze it, and save the configuration first.</p>
        </div>
      </div>
    );
  }

  // Filter out checklist items from normal dynamic text inputs
  const checklistKeys = CHECKLIST_ITEMS.map(item => item.key);
  const standardFields = fields.filter(f => !checklistKeys.includes(f.name));

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Generate New Report</h1>

      {/* 1. AI Auto-Fill with Notes or Handwritten Image OCR */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-indigo-400" /> AI Auto-Fill & Vision OCR
          </h2>
          <span className="text-xs bg-blue-50 dark:bg-indigo-900/50 text-blue-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
            Handwritten Notes & Image OCR
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload a photo of handwritten notes/documents or paste text notes. Gemini Vision API will extract information and automatically fill the form fields.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <textarea
            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            rows={4}
            placeholder="Paste raw transcript, meeting notes, or session details here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div
            onClick={() => ocrInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-blue-50/50 transition text-center"
          >
            <ImageIcon className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {ocrImage ? ocrImage.name : 'Upload Photo of Notes / Document'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">Supports JPG, PNG, PDF (Handwritten or Printed)</p>
            <input
              type="file"
              ref={ocrInputRef}
              className="hidden"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => e.target.files && setOcrImage(e.target.files[0])}
            />
          </div>
        </div>

        {ocrImage && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-indigo-800/50 rounded-lg text-xs">
            <span className="text-blue-900 dark:text-indigo-300 font-medium truncate">Selected Image: {ocrImage.name}</span>
            <button onClick={() => setOcrImage(null)} className="text-blue-600 dark:text-indigo-400 hover:underline">
              Remove
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleAutoFillWithImage}
            disabled={isAutofilling || (!notes.trim() && !ocrImage)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-50 transition text-sm"
          >
            {isAutofilling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Image & Text...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Auto-Fill Form
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Notice and Brochure Dedicated Upload Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Upload Notice and Brochure Photo
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload the event notice, brochure flyer, or announcement photo. It will be embedded into the generated document.
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
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Ready to attach to report</p>
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

      {/* 3. NEW FEATURE: Event Photos Section (Multiple Uploads & 2x3 Grid Layout) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Images className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Event Photos (Multiple Uploads)
          </h2>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-medium">
            Automated 2x3 Grid Layout
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Upload multiple event photographs (e.g. 2, 4, 6 photos). The system automatically formats them into a neat 2-column grid layout on a dedicated page in your document.
        </p>

        <div
          onClick={() => eventPhotosInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-slate-900/50 hover:bg-emerald-50/50 transition text-center"
        >
          <Images className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Click to upload multiple Event Photos
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Select 2, 4, 6 or more photos (JPG, PNG)</p>
          <input
            type="file"
            multiple
            ref={eventPhotosInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => handleAddEventPhotos(e.target.files)}
          />
        </div>

        {/* Selected Event Photos Grid Preview */}
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
                  <p className="text-[10px] text-gray-400">
                    {(photo.size / 1024).toFixed(1)} KB
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

      {/* 4. Consolidated 3-State Checklist Box */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b dark:border-slate-700 pb-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Checklist</h2>
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

      {/* 5. Form Fields Grid (NO mandatory required constraints) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="border-b dark:border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Event Report Details</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">All fields are optional. Leave empty fields blank in the generated document.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {standardFields.map((field, index) => (
              <div key={index} className="flex flex-col space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    rows={3}
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder="Optional..."
                  />
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    className="border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder="Optional..."
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
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm hover:shadow transition disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
              Generate Document
            </button>
          </div>
        </form>
      </div>

      {/* 6. Generation Results Bar */}
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
              <a
                href={generatedFiles.docxUrl}
                download
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl font-medium hover:bg-emerald-100 dark:hover:bg-slate-700 transition shadow-xs text-sm"
              >
                <Download className="w-4 h-4" /> Download DOCX
              </a>
            )}
            {generatedFiles.pdfUrl && (
              <a
                href={generatedFiles.pdfUrl}
                download
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-slate-700 transition shadow-xs text-sm"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
