import { useRef, useState } from 'react';
import { useInvoiceStore } from '../store/invoiceStore';
import { convertPdfToImages } from '../utils/pdfToImages';
import { parseInvoiceFromImages } from '../utils/ocrParser';

export interface FileEntry {
  file: File;
  fileId: string;
}

export interface Progress {
  current: number;
  total: number;
}

interface UseInvoiceProcessorResult {
  isProcessing: boolean;
  progress: Progress | null;
  process: (entries: FileEntry[], apiKey: string) => Promise<void>;
  retry: (fileId: string, apiKey: string) => Promise<void>;
}

export function useInvoiceProcessor(): UseInvoiceProcessorResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const { addInvoices, updateInvoice } = useInvoiceStore();

  // 재시도를 위해 파일 참조를 메모리에 보관
  const filesRef = useRef<Map<string, File>>(new Map());

  async function processOne(file: File, fileId: string, apiKey: string): Promise<void> {
    updateInvoice(fileId, { status: 'processing' });
    try {
      const images = await convertPdfToImages(file);
      const parsed = await parseInvoiceFromImages(images, apiKey);
      updateInvoice(fileId, { ...parsed, fileId, fileName: file.name, status: 'done' });
    } catch (err) {
      console.error(`[${file.name}] 처리 실패:`, err instanceof Error ? err.message : String(err));
      updateInvoice(fileId, { status: 'error' });
    }
  }

  async function process(entries: FileEntry[], apiKey: string): Promise<void> {
    if (entries.length === 0 || isProcessing) return;

    entries.forEach(({ file, fileId }) => filesRef.current.set(fileId, file));

    setIsProcessing(true);
    setProgress({ current: 0, total: entries.length });

    addInvoices(
      entries.map(({ file, fileId }) => ({
        fileId,
        fileName: file.name,
        status: 'pending',
        companyName: '',
        representative: '',
        businessNumber: '',
        address: '',
        paymentRequestDate: '',
        remarks: '',
        items: [],
        totals: { supplyAmount: 0, vat: 0, totalAmount: 0 },
      }))
    );

    for (let i = 0; i < entries.length; i++) {
      setProgress({ current: i + 1, total: entries.length });
      await processOne(entries[i].file, entries[i].fileId, apiKey);
    }

    setIsProcessing(false);
    setProgress(null);
  }

  async function retry(fileId: string, apiKey: string): Promise<void> {
    if (isProcessing) return;
    const file = filesRef.current.get(fileId);
    if (!file) return;

    setIsProcessing(true);
    setProgress({ current: 1, total: 1 });
    await processOne(file, fileId, apiKey);
    setIsProcessing(false);
    setProgress(null);
  }

  return { isProcessing, progress, process, retry };
}
