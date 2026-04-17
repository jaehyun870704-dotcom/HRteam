import { Workbook } from 'exceljs';
import type { Worksheet, Border, Fill, Borders } from 'exceljs';
import type { InvoiceData } from '../types/invoice';

// ── 스타일 상수 ────────────────────────────────────────────────────────────

const THIN: Border = { style: 'thin', color: { argb: 'FF000000' } };
const ALL_BORDERS: Borders = { top: THIN, bottom: THIN, left: THIN, right: THIN, diagonal: {} };

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

// 스타일 정의 타입 (exceljs 셀 속성 서브셋)
interface StyleDef {
  bold?: boolean;
  fill?: Fill;
  horizontal?: 'left' | 'center' | 'right';
  numFmt?: string;
  wrapText?: boolean;
}

/** 셀에 값 + 스타일을 적용한다. */
function S(ws: Worksheet, row: number, col: number, value: string | number | null, style: StyleDef) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = { name: '맑은 고딕', size: 10, bold: style.bold ?? false };
  if (style.fill) cell.fill = style.fill;
  cell.alignment = {
    horizontal: style.horizontal ?? 'left',
    vertical: 'middle',
    wrapText: style.wrapText ?? false,
  };
  if (style.numFmt) cell.numFmt = style.numFmt;
}

/** 수식 셀에 스타일을 적용한다. */
function SF(ws: Worksheet, row: number, col: number, formula: string, result: number, style: StyleDef) {
  const cell = ws.getCell(row, col);
  cell.value = { formula, result };
  cell.font = { name: '맑은 고딕', size: 10, bold: style.bold ?? false };
  if (style.fill) cell.fill = style.fill;
  cell.alignment = { horizontal: style.horizontal ?? 'right', vertical: 'middle' };
  if (style.numFmt) cell.numFmt = style.numFmt;
}

// 자주 쓰는 스타일 프리셋
const PRESET = {
  /** 요약 시트 헤더 */
  summaryHeader: { bold: true, fill: solidFill('FFE8F4F8'), horizontal: 'center' } as StyleDef,
  /** [거래처] 타이틀 행 */
  sectionHeader: { bold: true, fill: solidFill('FFE8E8E8'), horizontal: 'left' } as StyleDef,
  /** 상호/주소 등 레이블 셀 */
  label: { bold: true, fill: solidFill('FFF2F2F2'), horizontal: 'center' } as StyleDef,
  /** 일반 값 셀 */
  value: { horizontal: 'left' } as StyleDef,
  /** 품목 테이블 헤더 */
  itemHeader: { bold: true, fill: solidFill('FFF2F2F2'), horizontal: 'center' } as StyleDef,
  /** 숫자 셀 (우측 정렬, 천단위 콤마) */
  num: { horizontal: 'right', numFmt: '#,##0' } as StyleDef,
  /** 합계행 레이블 */
  totalLabel: { bold: true, fill: solidFill('FFF2F2F2'), horizontal: 'center' } as StyleDef,
  /** 합계행 숫자 */
  totalNum: { bold: true, fill: solidFill('FFF2F2F2'), horizontal: 'right', numFmt: '#,##0' } as StyleDef,
  /** 합계행 빈 셀 */
  totalEmpty: { bold: true, fill: solidFill('FFF2F2F2') } as StyleDef,
  /** 비고 값 (줄바꿈 허용) */
  remarks: { horizontal: 'left', wrapText: true } as StyleDef,
};

// ── 시트 레이아웃 빌더 ────────────────────────────────────────────────────
//
// 컬럼 구성 (6열)
//   A (col 1, w=12): 레이블 / 품목명 시작
//   B (col 2, w=20): 값 넓음 / 품목명 끝
//   C (col 3, w=14): 값 넓음 / 공급가액
//   D (col 4, w=10): 레이블 / VAT
//   E (col 5, w=14): 값 넓음 / 총합계금액
//   F (col 6, w=14): 값 넓음 / 비고
//
// 병합 구조:
//   [거래처] → A:F
//   상호 값  → B:C   /  대표자명 값 → E:F
//   주소 값  → B:C   /  사업자번호 값 → E:F
//   첨부 값  → B:C   /  지급요청일 값 → E:F
//   품목명   → A:B
//   합계 레이블 → A:B
//   비고 값  → B:F

function buildSheet(ws: Worksheet, invoice: InvoiceData): void {
  // 열 너비
  ws.columns = [
    { width: 12 }, // A
    { width: 20 }, // B
    { width: 14 }, // C
    { width: 10 }, // D
    { width: 14 }, // E
    { width: 14 }, // F
  ];

  let r = 1;

  // ── Row 1: [거래처] 타이틀 ──
  ws.mergeCells(r, 1, r, 6);
  S(ws, r, 1, '[거래처]', PRESET.sectionHeader);
  ws.getRow(r).height = 20;
  r++;

  // ── Row 2: 상호 / 대표자명 ──
  ws.mergeCells(r, 2, r, 3);
  ws.mergeCells(r, 5, r, 6);
  S(ws, r, 1, '상  호', PRESET.label);
  S(ws, r, 2, invoice.companyName, PRESET.value);
  S(ws, r, 4, '대표자명', PRESET.label);
  S(ws, r, 5, invoice.representative, PRESET.value);
  ws.getRow(r).height = 18;
  r++;

  // ── Row 3: 주소 / 사업자번호 ──
  ws.mergeCells(r, 2, r, 3);
  ws.mergeCells(r, 5, r, 6);
  S(ws, r, 1, '주  소', PRESET.label);
  S(ws, r, 2, invoice.address, PRESET.value);
  S(ws, r, 4, '사업자번호', PRESET.label);
  S(ws, r, 5, invoice.businessNumber, PRESET.value);
  ws.getRow(r).height = 18;
  r++;

  // ── Row 4: 첨부 / 지급요청일 ──
  ws.mergeCells(r, 2, r, 3);
  ws.mergeCells(r, 5, r, 6);
  S(ws, r, 1, '첨  부', PRESET.label);
  S(ws, r, 2, null, PRESET.value);
  S(ws, r, 4, '지급요청일', PRESET.label);
  S(ws, r, 5, invoice.paymentRequestDate, PRESET.value);
  ws.getRow(r).height = 18;
  r++;

  // ── Row 5: 품목 테이블 헤더 ──
  ws.mergeCells(r, 1, r, 2);
  S(ws, r, 1, '품목 및 내역', PRESET.itemHeader);
  S(ws, r, 3, '공급가액', PRESET.itemHeader);
  S(ws, r, 4, 'VAT', PRESET.itemHeader);
  S(ws, r, 5, '총합계금액', PRESET.itemHeader);
  S(ws, r, 6, '비고', PRESET.itemHeader);
  ws.getRow(r).height = 18;
  r++;

  // ── 품목 행 ──
  for (const item of invoice.items) {
    ws.mergeCells(r, 1, r, 2);
    S(ws, r, 1, item.itemName, PRESET.value);
    S(ws, r, 3, item.supplyAmount, PRESET.num);
    S(ws, r, 4, item.vat, PRESET.num);
    S(ws, r, 5, item.totalAmount, PRESET.num);
    S(ws, r, 6, item.remarks, PRESET.value);
    ws.getRow(r).height = 18;
    r++;
  }

  // 품목이 없을 때 빈 행 1개
  if (invoice.items.length === 0) {
    ws.mergeCells(r, 1, r, 2);
    for (let c = 1; c <= 6; c++) S(ws, r, c, null, PRESET.value);
    ws.getRow(r).height = 18;
    r++;
  }

  // ── 합계 행 ──
  ws.mergeCells(r, 1, r, 2);
  S(ws, r, 1, '합  계', PRESET.totalLabel);
  S(ws, r, 3, invoice.totals.supplyAmount, PRESET.totalNum);
  S(ws, r, 4, invoice.totals.vat, PRESET.totalNum);
  S(ws, r, 5, invoice.totals.totalAmount, PRESET.totalNum);
  S(ws, r, 6, null, PRESET.totalEmpty);
  ws.getRow(r).height = 18;
  r++;

  // ── 비고 행 ──
  ws.mergeCells(r, 2, r, 6);
  S(ws, r, 1, '비  고', PRESET.label);
  S(ws, r, 2, invoice.remarks, PRESET.remarks);
  ws.getRow(r).height = invoice.remarks ? 36 : 20;
  r++;

  // ── 전체 셀 테두리 적용 ──
  for (let row = 1; row < r; row++) {
    for (let col = 1; col <= 6; col++) {
      ws.getCell(row, col).border = ALL_BORDERS;
    }
  }
}

// ── 전체 요약 시트 빌더 ───────────────────────────────────────────────────
//
// 컬럼 구성 (9열)
//   A(5): 번호  B(20): 거래처명  C(14): 대표자명  D(16): 사업자등록번호
//   E(14): 지급요청일자  F(14): 공급가액  G(12): VAT  H(14): 총합계금액  I(20): 비고
//
// 마지막 행: 합계 레이블(A:E 병합) + SUM 수식(F,G,H)

function buildSummarySheet(ws: Worksheet, invoices: InvoiceData[]): void {
  ws.columns = [
    { width: 5 },   // A 번호
    { width: 20 },  // B 거래처명
    { width: 14 },  // C 대표자명
    { width: 16 },  // D 사업자등록번호
    { width: 14 },  // E 지급요청일자
    { width: 14 },  // F 공급가액
    { width: 12 },  // G VAT
    { width: 14 },  // H 총합계금액
    { width: 20 },  // I 비고
  ];

  const COLS = 9;

  // ── 헤더 행 ──
  const headers = ['번호', '거래처명', '대표자명', '사업자등록번호', '지급요청일자', '공급가액', 'VAT', '총합계금액', '비고'];
  headers.forEach((h, i) => S(ws, 1, i + 1, h, PRESET.summaryHeader));
  ws.getRow(1).height = 20;

  // ── 데이터 행 ──
  const numStyle: StyleDef = { horizontal: 'right', numFmt: '#,##0' };
  invoices.forEach((inv, idx) => {
    const r = idx + 2;
    S(ws, r, 1, idx + 1,                   { horizontal: 'center' });
    S(ws, r, 2, inv.companyName,            { horizontal: 'left' });
    S(ws, r, 3, inv.representative,         { horizontal: 'left' });
    S(ws, r, 4, inv.businessNumber,         { horizontal: 'center' });
    S(ws, r, 5, inv.paymentRequestDate,     { horizontal: 'center' });
    S(ws, r, 6, inv.totals.supplyAmount,    numStyle);
    S(ws, r, 7, inv.totals.vat,             numStyle);
    S(ws, r, 8, inv.totals.totalAmount,     numStyle);
    S(ws, r, 9, inv.remarks,                { horizontal: 'left' });
    ws.getRow(r).height = 18;
  });

  // ── 합계 행 ──
  const dataEnd = invoices.length + 1; // 마지막 데이터 행 번호
  const totalRow = invoices.length + 2;

  ws.mergeCells(totalRow, 1, totalRow, 5);
  S(ws, totalRow, 1, '합  계', PRESET.totalLabel);

  const sumS = { bold: true, fill: solidFill('FFF2F2F2'), horizontal: 'right', numFmt: '#,##0' } as StyleDef;
  SF(ws, totalRow, 6, `SUM(F2:F${dataEnd})`, invoices.reduce((a, i) => a + i.totals.supplyAmount, 0), sumS);
  SF(ws, totalRow, 7, `SUM(G2:G${dataEnd})`, invoices.reduce((a, i) => a + i.totals.vat, 0),          sumS);
  SF(ws, totalRow, 8, `SUM(H2:H${dataEnd})`, invoices.reduce((a, i) => a + i.totals.totalAmount, 0),  sumS);
  S(ws, totalRow, 9, null, PRESET.totalEmpty);
  ws.getRow(totalRow).height = 18;

  // ── 테두리 ──
  for (let r = 1; r <= totalRow; r++) {
    for (let c = 1; c <= COLS; c++) {
      ws.getCell(r, c).border = ALL_BORDERS;
    }
  }
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** Excel 시트명 정제: 특수문자 제거, 최대 20자 */
function safeSheetName(name: string): string {
  return (name.replace(/[*:/\\[\]?]/g, '').trim().slice(0, 20)) || '시트';
}

/** 파일명 정제: OS 금지문자 제거 */
function safeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

async function download(workbook: InstanceType<typeof Workbook>, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 공개 API ──────────────────────────────────────────────────────────────

/**
 * 단건 인보이스를 xlsx 파일로 내보낸다.
 * 파일명: 관리비_{거래처명}_{YYYYMMDD}.xlsx
 */
export async function exportSingleInvoice(invoice: InvoiceData): Promise<void> {
  const wb = new Workbook();
  wb.creator = '관리비 입금 처리';
  wb.created = new Date();

  const sheetName = safeSheetName(invoice.companyName || '세금계산서');
  const ws = wb.addWorksheet(sheetName);
  buildSheet(ws, invoice);

  const companyPart = safeFileName(invoice.companyName || '거래처');
  await download(wb, `관리비_${companyPart}_${todayStr()}.xlsx`);
}

/**
 * 여러 인보이스를 "전체 요약" 시트 + 개별 시트로 묶어 xlsx 파일로 내보낸다.
 * 첫 번째 시트: 전체 요약 (모든 인보이스 한 눈에)
 * 이후 시트: 인보이스별 세금계산서 레이아웃
 * 파일명: 관리비_일괄_{YYYYMMDD}.xlsx
 */
export async function exportAllInvoices(invoices: InvoiceData[]): Promise<void> {
  if (invoices.length === 0) return;

  const wb = new Workbook();
  wb.creator = '관리비 입금 처리';
  wb.created = new Date();

  // ── 1. 전체 요약 시트 (첫 번째) ──
  const summaryWs = wb.addWorksheet('전체 요약');
  buildSummarySheet(summaryWs, invoices);

  // ── 2. 개별 세금계산서 시트 ──
  const usedNames = new Map<string, number>();

  for (const invoice of invoices) {
    const baseName = safeSheetName(invoice.companyName || '세금계산서');
    const count = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, count + 1);

    // 동일 이름 시트 중복 방지: 두 번째부터 (2), (3) 접미사
    const sheetName = count === 0 ? baseName : `${baseName.slice(0, 17)}(${count + 1})`;
    buildSheet(wb.addWorksheet(sheetName), invoice);
  }

  await download(wb, `관리비_일괄_${todayStr()}.xlsx`);
}
