import { create } from 'zustand';
import type { InvoiceData } from '../types/invoice';

interface InvoiceStore {
  invoices: InvoiceData[];
  activeId: string | null;

  addInvoices: (invoices: InvoiceData[]) => void;
  updateInvoice: (fileId: string, patch: Partial<InvoiceData>) => void;
  setActive: (fileId: string | null) => void;
  removeInvoice: (fileId: string) => void;
}

export const useInvoiceStore = create<InvoiceStore>((set) => ({
  invoices: [],
  activeId: null,

  addInvoices: (invoices) =>
    set((state) => ({
      invoices: [...state.invoices, ...invoices],
    })),

  updateInvoice: (fileId, patch) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.fileId === fileId ? { ...inv, ...patch } : inv
      ),
    })),

  setActive: (fileId) => set({ activeId: fileId }),

  removeInvoice: (fileId) =>
    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.fileId !== fileId),
      activeId: state.activeId === fileId ? null : state.activeId,
    })),
}));
