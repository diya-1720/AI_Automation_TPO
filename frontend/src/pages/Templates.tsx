import { useState, useRef } from 'react';
import { API_BASE_URL } from '../config';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Image as ImageIcon, Download, Sparkles, Eye,
  ArrowRight, X, FileCheck, Layers
} from 'lucide-react';

interface ExtractedField {
  name: string;
  label: string;
  type: string;
  value: string;
  originalText: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
}

interface UploadedPhoto {
  filename: string;
  saved_path: string;
  url: string;
  ocr_description: string;
  assigned_placeholder: string;
}

export default function Templates() {
  // File Upload State
  const [masterTemplate, setMasterTemplate] = useState<File | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [templateDragOver, setTemplateDragOver] = useState(false);
  const [evidenceDragOver, setEvidenceDragOver] = useState(false);

  // Workflow & Processing State
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStage, setProgressStage] = useState('Preparing uploaded files...');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Extraction Data State
  const [templateFilename, setTemplateFilename] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [photoAssignments, setPhotoAssignments] = useState<Record<string, string>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  // UI Filtering & Generation State
  const [activeReviewTab, setActiveReviewTab] = useState<'all' | 'needs_review' | 'summaries' | 'photos'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{ docxUrl: string; pdfUrl: string | null } | null>(null);

  const masterInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers for File Selection & Drag Drop ---
  const handleMasterSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx' || ext === 'pdf') {
        setMasterTemplate(file);
        setError(null);
      } else {
        setError('Master template must be a DOCX or PDF file.');
      }
    }
  };

  const handleEvidenceSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const newFiles = Array.from(files).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'pdf', 'docx'].includes(ext || '');
      });
      setEvidenceFiles(prev => [...prev, ...newFiles]);
      setError(null);
    }
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // --- Main Analyze & AI Processing Flow ---
  const handleAnalyzeAndProcess = async () => {
    if (!masterTemplate && !templateFilename) {
      setError('Please upload a Master DOCX Template first.');
      return;
    }

    setIsAnalyzing(true);
    setActiveStep(2);
    setError(null);

    // Simulate progressive status updates
    setProgressPercent(15);
    setProgressStage('Reading Master Template structure...');

    setTimeout(() => {
      setProgressPercent(40);
      setProgressStage('Extracting text & running OCR on evidence (Images, PDFs, DOCX)...');
    }, 1500);

    setTimeout(() => {
      setProgressPercent(75);
      setProgressStage('Gemini AI analyzing fields, generating summaries & matching photos...');
    }, 3500);

    const formData = new FormData();
    if (masterTemplate) {
      formData.append('master_template', masterTemplate);
    }
    evidenceFiles.forEach(file => {
      formData.append('evidence_files', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/analyze-evidence`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to process template and evidence.');
      }

      const data = await response.json();
      
      setProgressPercent(100);
      setProgressStage('Complete! Preparing review screen...');

      // Store response data
      setTemplateFilename(data.template_filename);
      setFields(data.fields || []);
      
      // Initialize editable field values map
      const initialValues: Record<string, string> = {};
      (data.fields || []).forEach((f: ExtractedField) => {
        initialValues[f.name] = f.value || '';
      });

      // Include generated summaries in values map
      const genSums = data.generated_summaries || {};
      initialValues['activity_summary'] = genSums.activity_summary || '';
      initialValues['objectives'] = genSums.objectives || '';
      initialValues['outcomes'] = genSums.outcomes || '';
      initialValues['event_description'] = genSums.event_description || '';

      setFieldValues(initialValues);

      // Initialize photo assignments
      const initialPhotos: Record<string, string> = {};
      (data.uploaded_photos || []).forEach((photo: UploadedPhoto, index: number) => {
        const placeholder = photo.assigned_placeholder || `[PHOTO_${index + 1}]`;
        initialPhotos[placeholder] = photo.saved_path;
      });
      setPhotoAssignments(initialPhotos);
      setUploadedPhotos(data.uploaded_photos || []);

      setTimeout(() => {
        setIsAnalyzing(false);
        setActiveStep(3); // Transition to Review Step
      }, 600);

    } catch (err: any) {
      setError(err.message || 'An error occurred during evidence analysis');
      setIsAnalyzing(false);
      setActiveStep(1);
    }
  };

  // --- Field Edit Handlers ---
  const handleFieldValueChange = (name: string, val: string) => {
    setFieldValues(prev => ({ ...prev, [name]: val }));
  };

  // --- Report Generation Flow ---
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedReport(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: fieldValues,
          photo_assignments: photoAssignments,
          template_filename: templateFilename
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to generate document');
      }

      const data = await response.json();
      setGeneratedReport(data);
      setActiveStep(4);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating document');
    } finally {
      setIsGenerating(false);
    }
  };

  // Derived counts for confidence review
  const lowConfidenceFields = fields.filter(f => f.confidence_level === 'low');
  const highConfidenceFields = fields.filter(f => f.confidence_level === 'high');

  const filteredFields = fields.filter(f => {
    if (activeReviewTab === 'needs_review') return f.confidence_level === 'low';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8 overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
            AI Document Generation Studio
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload your master template & supporting evidence (images, PDFs, DOCX). The AI extracts text via OCR, populates fields with confidence scores, formats photos, and generates the final report.
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200 text-xs font-medium">
          <button
            onClick={() => setActiveStep(1)}
            className={`px-3 py-1.5 rounded-lg transition ${activeStep === 1 ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            1. Upload Files
          </button>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <button
            disabled={!fields.length}
            onClick={() => fields.length && setActiveStep(3)}
            className={`px-3 py-1.5 rounded-lg transition disabled:opacity-40 ${activeStep === 3 ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            3. Review & Edit ({lowConfidenceFields.length} Review)
          </button>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <button
            disabled={!generatedReport}
            onClick={() => generatedReport && setActiveStep(4)}
            className={`px-3 py-1.5 rounded-lg transition disabled:opacity-40 ${activeStep === 4 ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            4. Export
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* STEP 1: UPLOAD AREA */}
      {activeStep === 1 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Template Dropzone */}
            <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 transition shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" /> Master Template (DOCX or PDF)
                </h2>
                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Required</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setTemplateDragOver(true); }}
                onDragLeave={() => setTemplateDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setTemplateDragOver(false);
                  handleMasterSelect(e.dataTransfer.files);
                }}
                onClick={() => masterInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer border transition ${templateDragOver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              >
                <Upload className="w-10 h-10 text-blue-500 mb-3" />
                <p className="text-sm font-semibold text-gray-700">
                  {masterTemplate ? masterTemplate.name : 'Drag & drop Master DOCX or PDF template'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supports .docx and .pdf custom template formats</p>
                <input
                  type="file"
                  ref={masterInputRef}
                  className="hidden"
                  accept=".docx,.pdf"
                  onChange={(e) => handleMasterSelect(e.target.files)}
                />
              </div>

              {masterTemplate && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-blue-900 truncate">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    <span className="font-medium truncate">{masterTemplate.name}</span>
                    <span className="text-xs text-blue-600">({formatFileSize(masterTemplate.size)})</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMasterTemplate(null); }}
                    className="p-1 hover:bg-blue-100 rounded text-blue-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Evidence Files Dropzone */}
            <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 hover:border-indigo-500 transition shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Upload Evidence Files
                </h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">Multiple Allowed</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setEvidenceDragOver(true); }}
                onDragLeave={() => setEvidenceDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setEvidenceDragOver(false);
                  handleEvidenceSelect(e.dataTransfer.files);
                }}
                onClick={() => evidenceInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer border transition ${evidenceDragOver ? 'bg-indigo-50 border-indigo-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              >
                <ImageIcon className="w-10 h-10 text-indigo-500 mb-3" />
                <p className="text-sm font-semibold text-gray-700">Drag & drop evidence files here</p>
                <p className="text-xs text-gray-500 mt-1">Supports Images (JPG, PNG), PDFs, and DOCX files</p>
                <input
                  type="file"
                  ref={evidenceInputRef}
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.docx"
                  onChange={(e) => handleEvidenceSelect(e.target.files)}
                />
              </div>
            </div>
          </div>

          {/* Uploaded Evidence File Previews Grid */}
          {evidenceFiles.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2">
                  Uploaded Evidence ({evidenceFiles.length} items)
                </h3>
                <button
                  onClick={() => setEvidenceFiles([])}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Clear All
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {evidenceFiles.map((file, idx) => {
                  const ext = file.name.split('.').pop()?.toLowerCase();
                  const isImg = ['jpg', 'jpeg', 'png'].includes(ext || '');

                  return (
                    <div key={idx} className="relative group bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition">
                      <button
                        onClick={() => removeEvidenceFile(idx)}
                        className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full shadow-xs transition z-10"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex flex-col items-center justify-center py-2 space-y-2">
                        {isImg ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded-lg border"
                          />
                        ) : ext === 'pdf' ? (
                          <div className="w-16 h-16 bg-red-100 text-red-700 rounded-lg flex items-center justify-center font-bold text-xs">
                            PDF
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">
                            DOCX
                          </div>
                        )}

                        <div className="text-center w-full px-1">
                          <p className="text-xs font-medium text-gray-800 truncate" title={file.name}>{file.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleAnalyzeAndProcess}
              disabled={isAnalyzing || (!masterTemplate && !templateFilename)}
              className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Sparkles className="w-5 h-5" />
              Analyze Template & Process Evidence
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PROCESSING PROGRESS LOADING */}
      {activeStep === 2 && (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center space-y-6 max-w-2xl mx-auto my-12">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">AI Evidence Extraction & Analysis</h2>
            <p className="text-sm text-gray-500 font-medium">{progressStage}</p>
          </div>

          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden border border-gray-200">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 text-xs text-gray-500 pt-4 border-t">
            <div className="flex flex-col items-center">
              <FileText className="w-4 h-4 mb-1 text-blue-600" />
              <span>Master Parsing</span>
            </div>
            <div className="flex flex-col items-center">
              <Eye className="w-4 h-4 mb-1 text-indigo-600" />
              <span>OCR & Extraction</span>
            </div>
            <div className="flex flex-col items-center">
              <Sparkles className="w-4 h-4 mb-1 text-emerald-600" />
              <span>AI Summarization</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: EDITABLE REVIEW SCREEN WITH CONFIDENCE SCORES */}
      {activeStep === 3 && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-emerald-400" /> AI Extraction & Preview Review
              </h2>
              <p className="text-xs text-gray-300">
                Review and edit extracted fields below. Fields with low AI confidence are highlighted for manual check. Validation is optional—generate the report even if fields are left blank.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10">
                <span className="block text-xl font-bold text-emerald-400">{highConfidenceFields.length}</span>
                <span className="text-[10px] text-gray-300 font-medium">High Confidence</span>
              </div>
              <div
                onClick={() => setActiveReviewTab('needs_review')}
                className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10 cursor-pointer hover:bg-amber-500/20 transition"
              >
                <span className="block text-xl font-bold text-amber-400">{lowConfidenceFields.length}</span>
                <span className="text-[10px] text-gray-300 font-medium">Review Needed</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setActiveReviewTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeReviewTab === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              All Dynamic Fields ({fields.length})
            </button>
            <button
              onClick={() => setActiveReviewTab('needs_review')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeReviewTab === 'needs_review' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              Low Confidence / Review Needed ({lowConfidenceFields.length})
            </button>
            <button
              onClick={() => setActiveReviewTab('summaries')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeReviewTab === 'summaries' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              AI Generated Summaries
            </button>
            <button
              onClick={() => setActiveReviewTab('photos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeReviewTab === 'photos' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Event Photos ({uploadedPhotos.length})
            </button>
          </div>

          {/* TAB CONTENT: Fields List */}
          {(activeReviewTab === 'all' || activeReviewTab === 'needs_review') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFields.map((field, idx) => {
                const isLow = field.confidence_level === 'low';
                return (
                  <div
                    key={idx}
                    className={`bg-white p-5 rounded-2xl border shadow-xs transition space-y-2 ${isLow ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-300' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        {field.label}
                      </label>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                          field.confidence_level === 'high'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : field.confidence_level === 'medium'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isLow ? <AlertTriangle className="w-3 h-3 text-amber-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {field.confidence_score}% Confidence
                      </span>
                    </div>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={fieldValues[field.name] || ''}
                        onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                        placeholder="Leave blank or type value..."
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    ) : (
                      <input
                        type="text"
                        value={fieldValues[field.name] || ''}
                        onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                        placeholder="Leave blank or type value..."
                        className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    )}

                    {field.originalText && (
                      <p className="text-[11px] text-gray-500 italic">
                        Original Template Placeholder: <span className="font-mono text-gray-700">{field.originalText}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB CONTENT: AI Summaries */}
          {activeReviewTab === 'summaries' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Activity Summary
                </label>
                <textarea
                  rows={4}
                  value={fieldValues['activity_summary'] || ''}
                  onChange={(e) => handleFieldValueChange('activity_summary', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Objectives (Bulleted)</label>
                  <textarea
                    rows={4}
                    value={fieldValues['objectives'] || ''}
                    onChange={(e) => handleFieldValueChange('objectives', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Outcomes (Bulleted)</label>
                  <textarea
                    rows={4}
                    value={fieldValues['outcomes'] || ''}
                    onChange={(e) => handleFieldValueChange('outcomes', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800">Event Description</label>
                <textarea
                  rows={4}
                  value={fieldValues['event_description'] || ''}
                  onChange={(e) => handleFieldValueChange('event_description', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB CONTENT: Photo Assignments */}
          {activeReviewTab === 'photos' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Event Photo Placement</h3>
                <span className="text-xs text-gray-500">Photos will be inserted into assigned placeholders preserving quality & aspect ratio.</span>
              </div>

              {uploadedPhotos.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">No image evidence uploaded. Upload JPG/PNG evidence files in Step 1 to map photos.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {uploadedPhotos.map((photo, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        className="w-full h-40 object-cover rounded-lg border bg-white"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-800 truncate">{photo.filename}</p>
                        <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{photo.ocr_description}</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-700">Assign to Placeholder:</label>
                        <select
                          value={photoAssignments[`[PHOTO_${idx + 1}]`] || photo.saved_path}
                          onChange={(e) => setPhotoAssignments(prev => ({ ...prev, [`[PHOTO_${idx + 1}]`]: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
                        >
                          <option value={photo.saved_path}>[PHOTO_{idx + 1}] - (Current Image)</option>
                          <option value="">Do Not Insert</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Final Action Bar */}
          <div className="flex items-center justify-between p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="text-xs text-gray-500">
              Clicking generate will replace placeholders, embed photos, and construct your DOCX report.
            </div>
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Generate Completed DOCX Report
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: EXPORT REPORT RESULT SCREEN */}
      {activeStep === 4 && generatedReport && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-md space-y-6 max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Report Generated Successfully!</h2>
            <p className="text-sm text-gray-500">
              Your document has been compiled with all extracted information, AI summaries, and aspect-ratio formatted photos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a
              href={generatedReport.docxUrl}
              download
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition"
            >
              <Download className="w-5 h-5" /> Download DOCX Report
            </a>
            {generatedReport.pdfUrl && (
              <a
                href={generatedReport.pdfUrl}
                download
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-sm transition"
              >
                <Download className="w-5 h-5" /> Download PDF Report
              </a>
            )}
          </div>

          <div className="pt-6 border-t">
            <button
              onClick={() => setActiveStep(1)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Start New Document Generation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
