import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle, Clock, Download,
  Edit3, Eye, FileDown, FileText, Loader2,
  RefreshCw, TriangleAlert, Upload,
} from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import { UploadZone } from '../components/UploadZone';
import { HistoryPanel } from '../components/HistoryPanel';
import { InvoiceView } from '../components/InvoiceView';
import { validateInvoice } from '../utils/invoiceValidator';
import { exportSingleInvoice, exportAllInvoices } from '../utils/excelExporter';
import { useInvoiceProcessor } from '../hooks/useInvoiceProcessor';
import type { InvoiceData, InvoiceStatus } from '../types/invoice';

// ── 토스트 ─────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className={[
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg',
      'text-sm font-medium pointer-events-none animate-fadeInUp',
      toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
    ].join(' ')}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {toast.message}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (message: string, type: ToastState['type'] = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 2000);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return { toast, show };
}

// ── 상태 뱃지 ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus | 'review', { label: string; icon: React.ReactNode; cls: string }> = {
  pending:    { label: '대기중',  icon: <Clock size={12} />,                            cls: 'bg-gray-100 text-gray-600' },
  processing: { label: '처리중',  icon: <Loader2 size={12} className="animate-spin" />, cls: 'bg-blue-100 text-blue-700' },
  done:       { label: '완료',    icon: <CheckCircle size={12} />,                      cls: 'bg-green-100 text-green-700' },
  error:      { label: '오류',    icon: <AlertCircle size={12} />,                      cls: 'bg-red-100 text-red-700' },
  review:     { label: '검토필요', icon: <TriangleAlert size={12} />,                    cls: 'bg-amber-100 text-amber-700' },
};

function StatusBadge({ status, review }: { status: InvoiceStatus; review: boolean }) {
  const key = status === 'done' && review ? 'review' : status;
  const { label, icon, cls } = STATUS_CFG[key];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ── 빈 상태 UI ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8 py-16">
      <div className="relative">
        <div className="w-20 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
          <FileText size={32} className="text-gray-300" strokeWidth={1.2} />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <Upload size={14} className="text-blue-500" />
        </div>
      </div>
      <div>
        <p className="text-base font-semibold text-gray-700">세금계산서를 업로드하세요</p>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
          좌측 "파일 업로드"에서 PDF를 선택하면<br />
          자동으로 OCR 분석이 시작됩니다
        </p>
      </div>
    </div>
  );
}

// ── 요약 카드 ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-800 leading-tight truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ── MainPage ───────────────────────────────────────────────────────────────

export function MainPage() {
  const { invoices, activeId, setActive, updateInvoice } = useInvoiceStore();
  const { isProcessing, progress, process, retry } = useInvoiceProcessor();
  const [isEditing, setIsEditing]     = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileTab, setMobileTab]     = useState<'list' | 'invoice'>('list');
  const { toast, show: showToast }    = useToast();

  const activeInvoice = invoices.find((inv) => inv.fileId === activeId) ?? null;

  const needsReview = (inv: InvoiceData) =>
    inv.status === 'done' && !validateInvoice(inv).isValid;

  const handleSetActive = (fileId: string) => {
    setActive(fileId);
    setIsEditing(false);
    setMobileTab('invoice'); // 모바일: 인보이스 탭으로 전환
  };

  // ── 재시도 ──
  const handleRetry = async (fileId: string) => {
    const apiKey = localStorage.getItem('anthropic_api_key') ?? '';
    if (!apiKey) { showToast('API 키를 먼저 입력하세요.', 'error'); return; }
    try {
      await retry(fileId, apiKey);
      showToast('재처리 완료');
    } catch {
      showToast('재처리 중 오류가 발생했습니다.', 'error');
    }
  };

  // ── 내보내기 ──
  const handleExportSingle = async () => {
    if (!activeInvoice || isExporting) return;
    setIsExporting(true);
    try {
      await exportSingleInvoice(activeInvoice);
      showToast(`"${activeInvoice.companyName || activeInvoice.fileName}" 저장 완료`);
    } catch { showToast('저장 중 오류가 발생했습니다.', 'error'); }
    finally   { setIsExporting(false); }
  };

  const handleExportAll = async () => {
    if (isExporting) return;
    const done     = invoices.filter((i) => i.status === 'done');
    const excluded = invoices.filter((i) => i.status === 'error').length;
    if (done.length === 0) return;
    setIsExporting(true);
    try {
      await exportAllInvoices(done);
      showToast(excluded > 0
        ? `${done.length}건 저장 완료 (오류 ${excluded}건 제외)`
        : `${done.length}건 저장 완료`);
    } catch { showToast('저장 중 오류가 발생했습니다.', 'error'); }
    finally   { setIsExporting(false); }
  };

  // ── 파생 통계 ──
  const doneCount    = invoices.filter((i) => i.status === 'done').length;
  const errorCount   = invoices.filter((i) => i.status === 'error').length;
  const totalAmount  = invoices.filter((i) => i.status === 'done').reduce((a, i) => a + i.totals.totalAmount, 0);
  const canExportAll    = doneCount > 0 && !isExporting && !isProcessing;
  const canExportSingle = activeInvoice?.status === 'done' && !isExporting && !isProcessing;
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base md:text-lg font-bold text-gray-900 tracking-tight">관리비 입금 처리</h1>
          <button
            onClick={handleExportAll}
            disabled={!canExportAll}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors',
              canExportAll
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {isExporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            <span className="hidden sm:inline">전체 xlsx 일괄 저장</span>
            <span className="sm:hidden">일괄저장</span>
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SummaryCard label="전체 파일"  value={invoices.length} sub="건" />
          <SummaryCard label="처리 완료"  value={doneCount} sub={`/ ${invoices.length} 건`} />
          <SummaryCard label="오류"       value={errorCount} sub="건" />
          <SummaryCard label="총 합계금액" value={`₩${fmt(totalAmount)}`} sub="완료 기준" />
        </div>
      </header>

      {/* ── 모바일 탭 ── */}
      <div className="md:hidden flex border-b border-gray-200 bg-white shrink-0">
        {(['list', 'invoice'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={[
              'flex-1 py-2 text-sm font-medium transition-colors',
              mobileTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500',
            ].join(' ')}
          >
            {tab === 'list' ? '파일 목록' : '인보이스'}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── 사이드바 ── */}
        <aside className={[
          'w-full md:w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden',
          mobileTab === 'list' ? 'flex' : 'hidden',
          'md:flex',
        ].join(' ')}>

          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">파일 목록</p>
          </div>

          {invoices.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 px-4 py-8">
              <FileText size={28} strokeWidth={1.2} />
              <p className="text-xs text-center">업로드된 파일이 없습니다</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto py-1">
              {invoices.map((inv) => {
                const active  = inv.fileId === activeId;
                const review  = needsReview(inv);
                return (
                  <li key={inv.fileId}>
                    <button
                      onClick={() => handleSetActive(inv.fileId)}
                      className={[
                        'w-full text-left px-3 py-2.5 transition-colors border-r-2',
                        active ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50 border-transparent',
                      ].join(' ')}
                    >
                      <p className="text-sm font-medium text-gray-800 truncate leading-tight">{inv.fileName}</p>
                      {inv.companyName && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{inv.companyName}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        {inv.status === 'done'
                          ? <span className="text-xs font-medium text-gray-700">₩{fmt(inv.totals.totalAmount)}</span>
                          : <span />}
                        <StatusBadge status={inv.status} review={review} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 처리 이력 */}
          <HistoryPanel onSelect={handleSetActive} />

          {/* 파일 업로드 */}
          <div className="border-t border-gray-100 p-2">
            <details className="group">
              <summary className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer
                                  text-xs text-blue-600 font-medium hover:bg-blue-50 transition-colors
                                  list-none select-none">
                <Upload size={13} />파일 업로드
              </summary>
              <div className="pt-2">
                <UploadZone onProcess={process} isProcessing={isProcessing} />
              </div>
            </details>
          </div>
        </aside>

        {/* ── 메인 영역 ── */}
        <main className={[
          'flex-1 min-w-0 overflow-y-auto',
          mobileTab === 'invoice' ? 'flex flex-col' : 'hidden',
          'md:flex md:flex-col',
        ].join(' ')}>

          {!activeInvoice ? (
            <EmptyState />
          ) : activeInvoice.status === 'error' ? (
            /* ── 오류 상태 ── */
            <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-8 py-16">
              <AlertCircle size={44} className="text-red-400" strokeWidth={1.5} />
              <div>
                <p className="font-semibold text-gray-700">OCR 처리에 실패했습니다</p>
                <p className="text-sm text-gray-400 mt-1">
                  {activeInvoice.fileName}
                </p>
              </div>
              <button
                onClick={() => handleRetry(activeInvoice.fileId)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                           text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={14} />재시도
              </button>
            </div>
          ) : (
            /* ── 인보이스 뷰 ── */
            <div className="p-4 md:p-6">
              {/* 파일 헤더 */}
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-800 truncate">
                    {activeInvoice.companyName || activeInvoice.fileName}
                  </h2>
                  <p className="text-xs text-gray-400 truncate">{activeInvoice.fileName}</p>
                </div>

                {activeInvoice.status === 'done' && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setIsEditing((v) => !v)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        isEditing
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      ].join(' ')}
                    >
                      {isEditing ? <><Edit3 size={14} />편집 중</> : <><Eye size={14} />편집 모드</>}
                    </button>
                    <button
                      onClick={handleExportSingle}
                      disabled={!canExportSingle}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        canExportSingle
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      이 건 xlsx 저장
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                <InvoiceView
                  invoice={activeInvoice}
                  isEditing={isEditing && activeInvoice.status === 'done'}
                  onUpdate={(updated) => updateInvoice(activeInvoice.fileId, updated)}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── OCR 처리 진행 오버레이 ── */}
      {isProcessing && progress && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-7 shadow-2xl text-center w-72">
            <Loader2 size={36} className="animate-spin text-blue-600 mx-auto mb-4" />
            <p className="font-semibold text-gray-800 text-base mb-1">OCR 처리 중...</p>
            <p className="text-sm text-gray-500">
              {progress.current} / {progress.total} 파일
            </p>
            <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast && <Toast toast={toast} />}
    </div>
  );
}
