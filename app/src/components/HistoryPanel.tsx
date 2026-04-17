import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, History } from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import type { InvoiceData } from '../types/invoice';

// ── 타입 / 스토리지 ───────────────────────────────────────────────────────

export interface HistoryEntry {
  fileId: string;
  fileName: string;
  companyName: string;
  totalAmount: number;
  processedAt: string; // ISO 8601
  status: 'done' | 'error';
}

const SS_KEY = 'invoice_history';
const MAX_ENTRIES = 50;

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage 용량 초과 시 조용히 무시
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────

interface Props {
  onSelect: (fileId: string) => void;
}

export function HistoryPanel({ onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const prevInvoicesRef = useRef<InvoiceData[]>([]);

  const { invoices, activeId } = useInvoiceStore();
  const liveFileIds = new Set(invoices.map((i) => i.fileId));

  // 처리 완료/오류 전환 감지 → sessionStorage에 기록
  useEffect(() => {
    const prev = prevInvoicesRef.current;

    const newlyFinished = invoices.filter((inv) => {
      if (inv.status !== 'done' && inv.status !== 'error') return false;
      const prevInv = prev.find((p) => p.fileId === inv.fileId);
      return prevInv?.status !== inv.status; // 상태가 방금 바뀐 경우만
    });

    if (newlyFinished.length > 0) {
      setHistory((h) => {
        const newEntries: HistoryEntry[] = newlyFinished.map((inv) => ({
          fileId: inv.fileId,
          fileName: inv.fileName,
          companyName: inv.companyName,
          totalAmount: inv.totals.totalAmount,
          processedAt: new Date().toISOString(),
          status: inv.status as 'done' | 'error',
        }));

        // 동일 fileId 기존 항목 교체 (재시도 시 업데이트)
        const updated = [
          ...newEntries,
          ...h.filter((e) => !newEntries.some((n) => n.fileId === e.fileId)),
        ].slice(0, MAX_ENTRIES);

        saveHistory(updated);
        return updated;
      });
    }

    prevInvoicesRef.current = invoices;
  }, [invoices]);

  if (history.length === 0) return null;

  return (
    <div className="border-t border-gray-100">
      {/* 헤더 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500
                   font-semibold uppercase tracking-wide hover:bg-gray-50 transition-colors"
      >
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <History size={13} />
        처리 이력
        <span className="ml-auto bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          {history.length}
        </span>
      </button>

      {/* 이력 목록 */}
      {isOpen && (
        <ul className="max-h-48 overflow-y-auto pb-1">
          {history.map((entry) => {
            const isLive = liveFileIds.has(entry.fileId);
            const isActive = entry.fileId === activeId;

            return (
              <li key={`${entry.fileId}-${entry.processedAt}`}>
                <button
                  onClick={() => isLive && onSelect(entry.fileId)}
                  disabled={!isLive}
                  className={[
                    'w-full text-left px-3 py-2 transition-colors',
                    isActive  ? 'bg-blue-50'  : '',
                    isLive    ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-40 cursor-default',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5">
                    {entry.status === 'done'
                      ? <CheckCircle size={11} className="text-green-500 shrink-0" />
                      : <AlertCircle size={11} className="text-red-400 shrink-0" />}
                    <span className="text-xs text-gray-700 truncate flex-1">
                      {entry.companyName || entry.fileName}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {formatTime(entry.processedAt)}
                    </span>
                  </div>
                  {entry.status === 'done' && entry.totalAmount > 0 && (
                    <p className="text-[10px] text-gray-500 pl-4 mt-0.5">
                      ₩{entry.totalAmount.toLocaleString('ko-KR')}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
