import type { InvoiceData } from '../types/invoice';

const MODEL = 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `당신은 한국 세금계산서 OCR 전문가입니다.
이미지에서 다음 필드를 추출하여 반드시 JSON 형식으로만 응답하세요:
companyName, representative, businessNumber, address,
paymentRequestDate, remarks, items(배열), totals`;

/** Claude API 응답 텍스트에서 JSON 블록을 추출한다. */
function extractJson(text: string): string {
  // ```json ... ``` 블록 우선 탐색
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // 중괄호로 시작하는 첫 번째 JSON 객체 탐색
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return text.trim();
}

/**
 * 세금계산서 이미지 배열을 Claude API로 분석하여 InvoiceData를 반환한다.
 * @param images  - `data:image/png;base64,...` 형식의 이미지 배열 (PDF 각 페이지)
 * @param apiKey  - Anthropic API 키
 */
export async function parseInvoiceFromImages(
  images: string[],
  apiKey: string
): Promise<InvoiceData> {
  const imageContent = images.map((dataUrl) => {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: base64,
      },
    };
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: '위 세금계산서 이미지에서 모든 필드를 추출하여 JSON으로 응답하세요.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API 오류 (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const rawText: string = result?.content?.[0]?.text ?? '';

  let parsed: Partial<InvoiceData>;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch {
    throw new Error(
      `JSON 파싱 실패. Claude 원본 응답:\n${rawText}`
    );
  }

  // 필수 필드 기본값 보장
  return {
    fileId: '',
    fileName: '',
    status: 'done',
    companyName: parsed.companyName ?? '',
    representative: parsed.representative ?? '',
    businessNumber: parsed.businessNumber ?? '',
    address: parsed.address ?? '',
    paymentRequestDate: parsed.paymentRequestDate ?? '',
    remarks: parsed.remarks ?? '',
    items: parsed.items ?? [],
    totals: parsed.totals ?? { supplyAmount: 0, vat: 0, totalAmount: 0 },
  };
}
