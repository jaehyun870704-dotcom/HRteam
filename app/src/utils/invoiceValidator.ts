import type { InvoiceData, InvoiceItem } from '../types/invoice';

const VAT_RATE = 0.1;
const TOLERANCE = 1; // 원화 1원 허용 오차

export interface ItemValidation {
  itemId: string;
  sumMismatch: boolean; // supplyAmount + vat ≠ totalAmount
}

export interface TotalsValidation {
  supplyMismatch: boolean; // Σ item.supplyAmount ≠ totals.supplyAmount
  vatMismatch: boolean;
  totalMismatch: boolean;
}

export interface InvoiceValidation {
  items: ItemValidation[];
  totals: TotalsValidation;
  isValid: boolean;
}

/** 품목 1행 검증: 공급가액 + VAT = 총합계금액 */
export function validateItem(item: InvoiceItem): ItemValidation {
  return {
    itemId: item.id,
    sumMismatch: Math.abs(item.supplyAmount + item.vat - item.totalAmount) > TOLERANCE,
  };
}

/** 합계행 검증: 품목 합산 vs totals 필드 */
export function validateTotals(invoice: InvoiceData): TotalsValidation {
  const sum = (fn: (i: InvoiceItem) => number) =>
    invoice.items.reduce((acc, i) => acc + fn(i), 0);
  return {
    supplyMismatch: Math.abs(sum((i) => i.supplyAmount) - invoice.totals.supplyAmount) > TOLERANCE,
    vatMismatch:    Math.abs(sum((i) => i.vat)          - invoice.totals.vat)          > TOLERANCE,
    totalMismatch:  Math.abs(sum((i) => i.totalAmount)  - invoice.totals.totalAmount)  > TOLERANCE,
  };
}

/** 전체 검증 결과 */
export function validateInvoice(invoice: InvoiceData): InvoiceValidation {
  const items = invoice.items.map(validateItem);
  const totals = validateTotals(invoice);
  const isValid =
    items.every((i) => !i.sumMismatch) &&
    !totals.supplyMismatch &&
    !totals.vatMismatch &&
    !totals.totalMismatch;
  return { items, totals, isValid };
}

/** 공급가액으로 VAT(10%) 및 총합계 자동 계산 */
export function autoCalcFromSupply(supply: number): { vat: number; totalAmount: number } {
  const vat = Math.round(supply * VAT_RATE);
  return { vat, totalAmount: supply + vat };
}

/** 품목 목록에서 합계행 재계산 */
export function recalcTotals(items: InvoiceItem[]): InvoiceData['totals'] {
  const sum = (fn: (i: InvoiceItem) => number) => items.reduce((acc, i) => acc + fn(i), 0);
  return {
    supplyAmount: sum((i) => i.supplyAmount),
    vat:          sum((i) => i.vat),
    totalAmount:  sum((i) => i.totalAmount),
  };
}
