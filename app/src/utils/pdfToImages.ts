import * as pdfjsLib from 'pdfjs-dist';

// pdfjs-dist v5 workerSrc — Vite가 빌드 시 public 경로로 복사하거나 CDN을 사용
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const RENDER_SCALE = 2.0; // 고해상도 렌더링 (OCR 정확도 향상)

/**
 * PDF 파일을 페이지별 PNG base64 이미지 배열로 변환한다.
 * @param file - 사용자가 선택한 PDF File 객체
 * @returns 각 페이지를 `data:image/png;base64,...` 형식으로 담은 배열
 */
export async function convertPdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const totalPages = pdf.numPages;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`페이지 ${pageNum}: canvas 2d context를 가져올 수 없습니다.`);

    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;

    images.push(canvas.toDataURL('image/png'));
  }

  return images;
}
