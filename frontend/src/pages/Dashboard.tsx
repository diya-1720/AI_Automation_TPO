import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Folder,
  FileText,
  Settings as SettingsIcon,
  Search,
  Clock,
  Award,
  Sparkles,
  Download,
  Trash2,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  FileDown
} from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ReportRecord {
  id: string;
  activity_name: string;
  docxFilename?: string;
  pdfFilename?: string;
  created_at?: string;
  date_of_event?: string;
  organizer?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [templatesCount, setTemplatesCount] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch reports
      const repRes = await fetch(`${API_BASE_URL}/api/reports`);
      if (repRes.ok) {
        const data = await repRes.json();
        setReports(Array.isArray(data) ? data : []);
      }

      // Fetch templates count
      const fieldsRes = await fetch(`${API_BASE_URL}/api/templates/fields`);
      if (fieldsRes.ok) {
        setTemplatesCount(1);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report record?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id && r.docxFilename !== id));
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredReports = reports.filter((r) =>
    (r.activity_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.organizer || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalHoursSaved = reports.length * 2.5;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Documentation Platform</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Executive Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accelerating institutional documentation for TPO, NSS, IEEE & Academic Committees.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/new-report"
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-md shadow-indigo-600/20 transition"
          >
            <FilePlus className="w-4 h-4 mr-2" />
            Generate New Report
          </Link>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Reports
            </span>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Folder className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {reports.length}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Published
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Archived in institutional database
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Time Saved
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              ~{totalHoursSaved > 0 ? totalHoursSaved.toFixed(1) : '0'} hrs
            </span>
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              ~10 mins / report
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reduced from 2–3 hrs manual typing
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Templates
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {templatesCount} Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            TPO & Committee DOCX Master
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AI Vision OCR
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Gemini Vision
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Multi-modal note & poster parser
          </p>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => navigate('/new-report')}
            className="p-5 bg-linear-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl cursor-pointer hover:shadow-lg hover:scale-[1.01] transition duration-200 flex flex-col justify-between"
          >
            <div>
              <FilePlus className="w-7 h-7 mb-3 text-indigo-100" />
              <h3 className="font-bold text-base">New Event Report</h3>
              <p className="text-xs text-indigo-100/80 mt-1">
                Upload photos, posters, or notes to auto-generate DOCX/PDF.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-white">
              Start Generator <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => navigate('/reports')}
            className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition duration-200 flex flex-col justify-between"
          >
            <div>
              <Folder className="w-7 h-7 mb-3 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Previous Reports
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Search, filter, and re-download previously generated files.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Browse Archive <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => navigate('/templates')}
            className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition duration-200 flex flex-col justify-between"
          >
            <div>
              <FileText className="w-7 h-7 mb-3 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Template Studio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload or inspect master Word templates & placeholder tags.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Manage Templates <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => navigate('/settings')}
            className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition duration-200 flex flex-col justify-between"
          >
            <div>
              <SettingsIcon className="w-7 h-7 mb-3 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Institutional Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure default college name, organizer, and theme.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400">
              Open Settings <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reports Section */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent Documentation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest generated event records and export downloads
            </p>
          </div>

          {/* Quick Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Reports List Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading documentation records...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No reports match your query.
            </p>
            <Link
              to="/new-report"
              className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Generate your first report <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Event Activity Title</th>
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Generated Date</th>
                  <th className="py-3 px-4 text-right">Downloads & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-xs">
                {filteredReports.slice(0, 5).map((report) => (
                  <tr
                    key={report.id || report.docxFilename}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {report.activity_name || 'Academic Event Report'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {report.organizer || 'Training & Placement Cell'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {report.created_at
                        ? new Date(report.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Recent'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {report.docxFilename && (
                        <a
                          href={`${API_BASE_URL}/generated/${report.docxFilename}`}
                          download
                          className="inline-flex items-center px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 font-medium rounded-lg text-[11px] transition"
                        >
                          <Download className="w-3 h-3 mr-1" /> DOCX
                        </a>
                      )}
                      {report.pdfFilename && (
                        <a
                          href={`${API_BASE_URL}/generated/${report.pdfFilename}`}
                          download
                          className="inline-flex items-center px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 font-medium rounded-lg text-[11px] transition"
                        >
                          <FileDown className="w-3 h-3 mr-1" /> PDF
                        </a>
                      )}
                      <button
                        onClick={(e) => handleDeleteReport(report.id || report.docxFilename || '', e)}
                        disabled={deletingId === (report.id || report.docxFilename)}
                        className="inline-flex items-center p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reports.length > 5 && (
          <div className="pt-2 text-right">
            <Link
              to="/reports"
              className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all {reports.length} reports in Archive <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
