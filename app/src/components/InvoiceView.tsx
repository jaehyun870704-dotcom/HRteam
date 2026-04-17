import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import type { InvoiceData, InvoiceItem } from '../types/invoice';
import {
  autoCalcFromSupply,
  recalcTotals,
  validateInvoice,
} from '../utils/invoiceValidator';

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  invoice: InvoiceData;
  isEditing?: boolean;
  onUpdate?: (updated: InvoiceData) => void;
}

// ── Cell navigation utilities ──────────────────────────────────────────────

function getCellOrder(invoice: InvoiceData): string[] {
  return [
    'companyName', 'representative',
    'address', 'businessNumber',
    'paymentRequestDate',
    ...invoice.items.flatMap((_, i) => [
      `item-${i}-itemName`,
      `item-${i}-supplyAmount`,
      `item-${i}-vat`,
      `item-${i}-totalAmount`,
      `item-${i}-remarks`,
    ]),
    'totals.supplyAmount', 'totals.vat', 'totals.totalAmount',
    'remarks',
  ];
}

function getRawValue(invoice: InvoiceData, key: string): string {
  if (key.startsWith('item-')) {
    const [, idxStr, ...rest] = key.split('-');
    const field = rest.join('-') as keyof InvoiceItem;
    return String(invoice.items[parseInt(idxStr)]?.[field] ?? '');
  }
  if (key.startsWith('totals.')) {
    const field = key.slice(7) as keyof InvoiceData['totals'];
    return String(invoice.totals[field] ?? 0);
  }
  return String((invoice as Record<string, unknown>)[key] ?? '');
}

function applyEdit(invoice: InvoiceData, key: string, raw: string): InvoiceData {
  const num = parseFloat(raw.replace(/,/g, '')) || 0;
  const numFields = new Set(['supplyAmount', 'vat', 'totalAmount']);

  if (key.startsWith('item-')) {
    const [, idxStr, ...rest] = key.split('-');
    const idx = parseInt(idxStr);
    const field = rest.join('-') as keyof InvoiceItem;
    const items = invoice.items.map((item, i) =>
      i === idx ? { ...item, [field]: numFields.has(field) ? num : raw } : item
    );
    return { ...invoice, items };
  }
  if (key.startsWith('totals.')) {
    const field = key.slice(7) as keyof InvoiceData['totals'];
    return { ...invoice, totals: { ...invoice.totals, [field]: num } };
  }
  return { ...invoice, [key]: raw };
}

// ── InlineCell ─────────────────────────────────────────────────────────────

interface InlineCellProps {
  cellKey: string;
  display: React.ReactNode;
  rawValue: string;
  isChanged: boolean;
  isEditable: boolean;
  isActive: boolean;
  editingValue: string;
  onEditingValueChange: (v: string) => void;
  onActivate: (key: string, raw: string) => void;
  onCommit: (key: string, value: string, dir?: 'next' | 'prev') => void;
  onCancel: () => void;
  hasError?: boolean;
  align?: 'left' | 'right' | 'center';
  suffix?: React.ReactNode;
}

function InlineCell({
  cellKey, display, rawValue, isChanged, isEditable, isActive, editingValue,
  onEditingValueChange, onActivate, onCommit, onCancel, hasError, align = 'left', suffix,
}: InlineCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }[align];

  useEffect(() => {
    if (isActive) inputRef.current?.focus();
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      committedRef.current = true;
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter') {
      committedRef.current = true;
      e.preventDefault();
      onCommit(cellKey, editingValue, 'next');
    } else if (e.key === 'Tab') {
      committedRef.current = true;
      e.preventDefault();
      onCommit(cellKey, editingValue, e.shiftKey ? 'prev' : 'next');
    }
  };

  const handleBlur = () => {
    if (!committedRef.current) onCommit(cellKey, editingValue);
    committedRef.current = false;
  };

  // ── 입력 활성 상태 ──
  if (isActive) {
    return (
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <input
          ref={inputRef}
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`flex-1 min-w-0 bg-blue-50 border border-blue-400 rounded outline-none
                      px-1 py-0 text-sm text-blue-800 ${alignClass}`}
        />
        {suffix}
      </div>
    );
  }

  // ── 뷰 전용 (isEditable=false) ──
  if (!isEditable) {
    return (
      <span className={`text-sm ${alignClass} ${hasError ? 'text-red-600' : ''}`}>
        {display || <span className="text-gray-300">—</span>}
        {hasError && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
      </span>
    );
  }

  // ── 편집 가능 뷰 (hover 시 연필 아이콘) ──
  return (
    <div
      className={`relative group flex items-center gap-1 cursor-text min-h-[1.25rem]
                  rounded px-1 -mx-1 hover:bg-gray-50 transition-colors ${alignClass}`}
      onClick={() => onActivate(cellKey, rawValue)}
    >
      <span
        className={[
          'flex-1 text-sm',
          isChanged ? 'text-blue-600 font-medium' : '',
          hasError ? 'text-red-600' : '',
        ].filter(Boolean).join(' ')}
      >
        {display || <span className="text-gray-300">—</span>}
      </span>
      {hasError && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
      <Pencil size={11} className="opacity-0 group-hover:opacity-40 text-gray-500 shrink-0 transition-opacity" />
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────

const S = {
  label: 'bg-gray-100 font-medium text-center text-xs text-gray-600 px-2 py-1.5 border border-gray-300 whitespace-nowrap',
  th:    'bg-gray-100 font-medium text-center text-xs text-gray-600 px-2 py-2 border border-gray-300',
  val:   (err = false) => `bg-white px-2 py-1.5 border ${err ? 'border-red-400 bg-red-50' : 'border-gray-300'}`,
  td:    (err = false) => `bg-white px-2 py-1.5 border ${err ? 'border-red-400 bg-red-50' : 'border-gray-300'}`,
  foot:  (err = false) => `bg-gray-50 font-semibold px-2 py-1.5 border ${err ? 'border-red-400 bg-red-50' : 'border-gray-300'}`,
};

// ── InvoiceView ────────────────────────────────────────────────────────────

export function InvoiceView({ invoice, isEditing = false, onUpdate }: Props) {
  const [local, setLocal] = useState<InvoiceData>(invoice);
  const originalRef = useRef<InvoiceData>(invoice);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const validation = useMemo(() => validateInvoice(local), [local]);
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  // 뷰 모드 전환 시 prop 동기화
  useEffect(() => {
    if (!isEditing) {
      setLocal(invoice);
      setActiveCell(null);
      setEditingValue('');
    }
  }, [invoice, isEditing]);

  // 편집 시작 시 원본 스냅샷 캡처
  useEffect(() => {
    if (isEditing) originalRef.current = { ...local };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const isChanged = useCallback(
    (key: string) =>
      isEditing && getRawValue(local, key) !== getRawValue(originalRef.current, key),
    [local, isEditing]
  );

  const handleActivate = (key: string, raw: string) => {
    setActiveCell(key);
    setEditingValue(raw);
  };

  const handleCancel = () => {
    setActiveCell(null);
    setEditingValue('');
  };

  const handleCommit = useCallback(
    (key: string, value: string, dir?: 'next' | 'prev') => {
      const updated = applyEdit(local, key, value);
      setLocal(updated);
      onUpdate?.(updated);

      if (dir) {
        const order = getCellOrder(updated);
        const nextIdx = order.indexOf(key) + (dir === 'next' ? 1 : -1);
        if (nextIdx >= 0 && nextIdx < order.length) {
          const nextKey = order[nextIdx];
          setActiveCell(nextKey);
          setEditingValue(getRawValue(updated, nextKey));
          return;
        }
      }
      setActiveCell(null);
      setEditingValue('');
    },
    [local, onUpdate]
  );

  // VAT 자동 계산 (onMouseDown으로 blur보다 먼저 실행)
  const handleAutoVat = (idx: number) => {
    const item = local.items[idx];
    if (!item) return;
    const { vat, totalAmount } = autoCalcFromSupply(item.supplyAmount);
    const items = local.items.map((it, i) => (i === idx ? { ...it, vat, totalAmount } : it));
    const updated = { ...local, items };
    setLocal(updated);
    onUpdate?.(updated);
  };

  // 합계행 재계산
  const handleRecalcTotals = () => {
    const updated = { ...local, totals: recalcTotals(local.items) };
    setLocal(updated);
    onUpdate?.(updated);
  };

  const handleAddItem = () => {
    const items = [
      ...local.items,
      { id: crypto.randomUUID(), itemName: '', supplyAmount: 0, vat: 0, totalAmount: 0, remarks: '' },
    ];
    const updated = { ...local, items };
    setLocal(updated);
    onUpdate?.(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const items = local.items.filter((_, i) => i !== idx);
    const updated = { ...local, items };
    setLocal(updated);
    onUpdate?.(updated);
  };

  // InlineCell props 빌더
  const cell = (
    key: string,
    display: React.ReactNode,
    align: 'left' | 'right' | 'center' = 'left',
    error = false,
    suffix?: React.ReactNode
  ) => ({
    cellKey: key,
    display,
    rawValue: getRawValue(local, key),
    isChanged: isChanged(key),
    isEditable: isEditing,
    isActive: activeCell === key,
    editingValue: activeCell === key ? editingValue : getRawValue(local, key),
    onEditingValueChange: setEditingValue,
    onActivate: handleActivate,
    onCommit: handleCommit,
    onCancel: handleCancel,
    hasError: error,
    align,
    suffix,
  });

  const totalsError = validation.totals;

  return (
    <div className="font-sans text-gray-800 space-y-3">

      {/* ── 검증 경고 배너 ── */}
      {isEditing && !validation.isValid && (
        <div className="flex items-center gap-2 p-2 rounded border border-amber-300 bg-amber-50 text-xs text-amber-700">
          <AlertTriangle size={13} className="shrink-0" />
          <span>금액 불일치가 있습니다. 빨간 테두리 셀을 확인하거나 합계 재계산(⚡)을 사용하세요.</span>
        </div>
      )}

      {/* ── 섹션 1: 거래처 정보 ── */}
      <div>
        <div className="bg-gray-700 text-white text-xs font-semibold px-3 py-1.5 rounded-t">
          거래처
        </div>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[12%]" /><col className="w-[38%]" />
            <col className="w-[12%]" /><col className="w-[38%]" />
          </colgroup>
          <tbody>
            <tr>
              <td className={S.label}>상&ensp;호</td>
              <td className={S.val()}><InlineCell {...cell('companyName', local.companyName)} /></td>
              <td className={S.label}>대표자명</td>
              <td className={S.val()}><InlineCell {...cell('representative', local.representative)} /></td>
            </tr>
            <tr>
              <td className={S.label}>주&ensp;소</td>
              <td className={S.val()}><InlineCell {...cell('address', local.address)} /></td>
              <td className={S.label}>사업자번호</td>
              <td className={S.val()}><InlineCell {...cell('businessNumber', local.businessNumber)} /></td>
            </tr>
            <tr>
              <td className={S.label}>첨&ensp;부</td>
              <td className={S.val()} />
              <td className={S.label}>지급요청일</td>
              <td className={S.val()}><InlineCell {...cell('paymentRequestDate', local.paymentRequestDate)} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 섹션 2: 품목 테이블 ── */}
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[28%]" /><col className="w-[18%]" />
          <col className="w-[14%]" /><col className="w-[20%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr>
            <th className={S.th}>품목 및 내역</th>
            <th className={S.th}>공급가액</th>
            <th className={S.th}>VAT</th>
            <th className={S.th}>총합계금액</th>
            <th className={S.th}>비고</th>
          </tr>
        </thead>
        <tbody>
          {local.items.length === 0 && !isEditing && (
            <tr>
              <td colSpan={5} className="border border-gray-300 text-center text-gray-400 text-sm py-4">
                품목이 없습니다.
              </td>
            </tr>
          )}

          {local.items.map((item, idx) => {
            const rowErr = validation.items[idx]?.sumMismatch ?? false;
            const supplyKey = `item-${idx}-supplyAmount`;

            const vatAutoBtn = isEditing && activeCell === supplyKey ? (
              <button
                onMouseDown={(e) => { e.preventDefault(); handleAutoVat(idx); }}
                className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px]
                           bg-amber-100 text-amber-700 hover:bg-amber-200 whitespace-nowrap"
              >
                <Zap size={9} />VAT 자동
              </button>
            ) : undefined;

            return (
              <tr key={item.id}>
                <td className={S.td()}>
                  <InlineCell {...cell(`item-${idx}-itemName`, item.itemName)} />
                </td>
                <td className={S.td(rowErr)}>
                  <InlineCell {...cell(supplyKey, fmt(item.supplyAmount), 'right', rowErr, vatAutoBtn)} />
                </td>
                <td className={S.td(rowErr)}>
                  <InlineCell {...cell(`item-${idx}-vat`, fmt(item.vat), 'right', rowErr)} />
                </td>
                <td className={S.td(rowErr)}>
                  <InlineCell {...cell(`item-${idx}-totalAmount`, fmt(item.totalAmount), 'right', rowErr)} />
                </td>
                <td className={S.td()}>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <InlineCell {...cell(`item-${idx}-remarks`, item.remarks)} />
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-400 hover:text-red-600 shrink-0 transition-colors"
                        aria-label="행 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {isEditing && (
            <tr>
              <td colSpan={5} className="border border-gray-300 p-0">
                <button
                  onClick={handleAddItem}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs
                             text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus size={13} />행 추가
                </button>
              </td>
            </tr>
          )}

          {/* ── 합계행 ── */}
          <tr>
            <td className={`${S.foot()} text-center text-xs`}>
              <div className="flex items-center justify-center gap-1">
                합&ensp;계
                {isEditing && (totalsError.supplyMismatch || totalsError.vatMismatch || totalsError.totalMismatch) && (
                  <button
                    onClick={handleRecalcTotals}
                    title="품목 합산으로 재계산"
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <Zap size={11} />
                  </button>
                )}
              </div>
            </td>
            <td className={S.foot(totalsError.supplyMismatch)}>
              <InlineCell {...cell('totals.supplyAmount', fmt(local.totals.supplyAmount), 'right', totalsError.supplyMismatch)} />
            </td>
            <td className={S.foot(totalsError.vatMismatch)}>
              <InlineCell {...cell('totals.vat', fmt(local.totals.vat), 'right', totalsError.vatMismatch)} />
            </td>
            <td className={S.foot(totalsError.totalMismatch)}>
              <InlineCell {...cell('totals.totalAmount', fmt(local.totals.totalAmount), 'right', totalsError.totalMismatch)} />
            </td>
            <td className={S.foot()} />
          </tr>
        </tbody>
      </table>

      {/* ── 섹션 3: 비고 ── */}
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[12%]" /><col />
        </colgroup>
        <tbody>
          <tr>
            <td className={S.label}>비&ensp;고</td>
            <td className={S.val()}>
              {isEditing && activeCell === 'remarks' ? (
                <textarea
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancel();
                    // Enter는 textarea 줄바꿈으로 사용
                  }}
                  onBlur={() => handleCommit('remarks', editingValue)}
                  rows={2}
                  className="w-full bg-blue-50 border border-blue-400 rounded outline-none
                             px-1 py-0 text-sm text-blue-800 resize-none"
                />
              ) : (
                <div
                  className={[
                    'relative group min-h-[1.25rem] rounded px-1 -mx-1',
                    isEditing ? 'cursor-text hover:bg-gray-50' : '',
                  ].join(' ')}
                  onClick={() => isEditing && handleActivate('remarks', local.remarks)}
                >
                  <span
                    className={[
                      'text-sm whitespace-pre-wrap',
                      isChanged('remarks') ? 'text-blue-600 font-medium' : '',
                    ].join(' ')}
                  >
                    {local.remarks || <span className="text-gray-300">—</span>}
                  </span>
                  {isEditing && (
                    <Pencil
                      size={11}
                      className="absolute right-1 top-1 opacity-0 group-hover:opacity-40
                                 text-gray-500 transition-opacity"
                    />
                  )}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
