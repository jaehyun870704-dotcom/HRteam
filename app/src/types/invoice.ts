export type InvoiceStatus = 'pending' | 'processing' | 'done' | 'error';

export interface InvoiceItem {
  id: string;
  itemName: string;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  remarks: string;
}

export interface InvoiceTotals {
  supplyAmount: number;
  vat: number;
  totalAmount: number;
}

export interface InvoiceData {
  // 파일 메타
  fileId: string;
  fileName: string;
  status: InvoiceStatus;

  // 사업자 정보
  companyName: string;
  representative: string;
  businessNumber: string;

  // 청구 정보
  address: string;
  paymentRequestDate: string;
  remarks: string;

  // 품목 및 합계
  items: InvoiceItem[];
  totals: InvoiceTotals;
}
