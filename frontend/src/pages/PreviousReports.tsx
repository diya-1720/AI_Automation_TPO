import { useState, useEffect } from 'react';
import { Folder, Download, Search, Loader2, RefreshCw, FileText, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ReportRecord {
  id: string;
  activity_name: string;
  created_at: string;
  timestamp: number;
  docx_url?: string;
  pdf_url?: string | null;
  docx_filename?: string;
  pdf_filename?: string | null;
  docxFilename?: string;
  pdfFilename?: string | null;
}

export default function PreviousReports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`);
      if (!response.ok) {
        throw new Error('Failed to fetch previous reports');
      }
      const data = await response.json();
      setReports(Array.isArray(data) ? data : (data.reports || []));
    } catch (err: any) {
      setError(err.message || 'Error loading previous reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report from archive?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id && r.docx_filename !== id && r.docxFilename !== id));
      } else {
        throw new Error('Failed to delete report from server');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting report');
    } finally {
      setDeletingId(null);
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

  const filteredReports = reports.filter((r) =>
    (r.activity_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.docx_filename || r.docxFilename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Folder className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Previous Reports Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access, search, download, and manage all saved academic event reports.
          </p>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-medium transition self-start md:self-auto shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by activity name or filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-xs"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-3">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Reports Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? 'No reports match your search query.'
              : 'Reports generated from the "New Report" section will automatically be saved in this institutional archive.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Activity Name</th>
                  <th className="px-6 py-4">Standard File Name</th>
                  <th className="px-6 py-4">Date Generated</th>
                  <th className="px-6 py-4 text-right">Downloads & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredReports.map((report) => {
                  const id = report.id || report.docx_filename || report.docxFilename || '';
                  const docxFile = report.docx_filename || report.docxFilename || 'report.docx';
                  const pdfFile = report.pdf_filename || report.pdfFilename || 'report.pdf';
                  const docxUrl = report.docx_url || (docxFile ? `/generated/${docxFile}` : '');
                  const pdfUrl = report.pdf_url || (pdfFile ? `/generated/${pdfFile}` : '');

                  return (
                    <tr key={id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {report.activity_name || 'Untitled Activity'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {pdfFile || docxFile}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {report.created_at
                            ? new Date(report.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Recent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {docxUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(docxUrl, docxFile)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-medium rounded-lg text-xs transition cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" /> DOCX
                            </button>
                          )}
                          {pdfUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(pdfUrl, pdfFile)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-medium rounded-lg text-xs transition cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" /> PDF
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(id)}
                            disabled={deletingId === id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition cursor-pointer"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
