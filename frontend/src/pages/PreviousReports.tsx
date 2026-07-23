import { useState, useEffect } from 'react';
import { Folder, Download, Search, Loader2, RefreshCw, FileText, Calendar, AlertCircle } from 'lucide-react';

interface ReportRecord {
  id: string;
  activity_name: string;
  created_at: string;
  timestamp: number;
  docx_url: string;
  pdf_url: string | null;
  docx_filename: string;
  pdf_filename: string | null;
}

export default function PreviousReports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/reports');
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

  const filteredReports = reports.filter(r =>
    (r.activity_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.docx_filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Folder className="w-8 h-8 text-blue-600" /> Previous Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access and download all automatically saved event reports with standardized naming.
          </p>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by activity name or filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <FileText className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-800">No Previous Reports Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {searchQuery
              ? 'No reports match your search query.'
              : 'Reports generated from the "New Report" or "Templates" section will be automatically saved here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold border-b">
                <tr>
                  <th className="px-6 py-4">Activity Name</th>
                  <th className="px-6 py-4">File Name Standard</th>
                  <th className="px-6 py-4">Date Generated</th>
                  <th className="px-6 py-4 text-right">Download Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {report.activity_name || 'Untitled Activity'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {report.pdf_filename || report.docx_filename}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {report.created_at || 'Just now'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.docx_url && (
                          <a
                            href={report.docx_url}
                            download
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition"
                          >
                            <Download className="w-3.5 h-3.5" /> DOCX
                          </a>
                        )}
                        {report.pdf_url && (
                          <a
                            href={report.pdf_url}
                            download
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
