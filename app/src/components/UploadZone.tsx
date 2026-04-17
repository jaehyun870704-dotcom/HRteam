import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Upload, X, Play, FileText,
  CheckCircle, AlertCircle, Clock, Loader2, KeyRound,
} from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import type { FileEntry } from '../hooks/useInvoiceProcessor';
import type { InvoiceStatus } from '../types/invoice';

const LS_API_KEY = 'anthropic_api_key';

interface Props {
  onProcess: (entries: FileEntry[], apiKey: string) => void;
  isProcessing: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg: Record<InvoiceStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending:    { label: '대기중', className: 'bg-gray-100 text-gray-600',   icon: <Clock size={12} /> },
    processing: { label: '처리중', className: 'bg-blue-100 text-blue-700',   icon: <Loader2 size={12} className="animate-spin" /> },
    done:       { label: '완료',   className: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
    error:      { label: '오류',   className: 'bg-red-100 text-red-700',     icon: <AlertCircle size={12} /> },
  };
  const { label, className, icon } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {icon}{label}
    </span>
  );
}

export function UploadZone({ onProcess, isProcessing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_API_KEY) ?? '');

  const invoices = useInvoiceStore((s) => s.invoices);

  useEffect(() => {
    localStorage.setItem(LS_API_KEY, apiKey);
  }, [apiKey]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfs.length === 0) return;
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      const newEntries: FileEntry[] = pdfs
        .filter((f) => !existing.has(f.name))
        .map((file) => ({ file, fileId: crypto.randomUUID() }));
      return [...prev, ...newEntries];
    });
  }, []);

  const removeEntry = useCallback((fileId: string) => {
    setEntries((prev) => prev.filter((e) => e.fileId !== fileId));
  }, []);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); };
  const onDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; };

  const handleStart = () => {
    const targets = entries.filter((e) => {
      const inv = invoices.find((i) => i.fileId === e.fileId);
      return !inv || inv.status === 'pending' || inv.status === 'error';
    });
    if (targets.length > 0) onProcess(targets, apiKey);
  };

  const getStatus = (fileId: string): InvoiceStatus =>
    invoices.find((i) => i.fileId === fileId)?.status ?? 'pending';

  const canStart = entries.length > 0 && apiKey.trim().length > 0 && !isProcessing;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* API 키 */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50">
        <KeyRound size={15} className="text-gray-400 shrink-0" />
        <input
          type="password"
          placeholder="Anthropic API 키"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
        />
      </div>

      {/* 드롭존 */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed',
          'cursor-pointer transition-colors py-7 px-4 select-none',
          isDragging
            ? 'border-blue-500 bg-blue-50 text-blue-600'
            : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100',
        ].join(' ')}
      >
        <Upload size={28} strokeWidth={1.5} />
        <p className="text-xs font-medium text-center">PDF 드래그 또는 클릭</p>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onInputChange} />
      </div>

      {/* 파일 카드 */}
      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {entries.map(({ file, fileId }) => {
            const status = getStatus(fileId);
            return (
              <li key={fileId} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white">
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
                </div>
                <StatusBadge status={status} />
                <button
                  onClick={() => removeEntry(fileId)}
                  disabled={status === 'processing'}
                  className="p-0.5 rounded text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                  aria-label="파일 제거"
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 분석 시작 버튼 */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className={[
          'flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg font-medium text-sm transition-colors',
          canStart
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed',
        ].join(' ')}
      >
        {isProcessing ? <><Loader2 size={14} className="animate-spin" />분석 중...</> : <><Play size={14} />전체 분석 시작</>}
      </button>

      {!apiKey.trim() && entries.length > 0 && (
        <p className="text-xs text-amber-600 text-center">API 키를 입력하세요.</p>
      )}
    </div>
  );
}
