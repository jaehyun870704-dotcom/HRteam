# 관리비 입금 처리

PDF 세금계산서를 업로드하면 Claude AI OCR로 자동 분석하여 엑셀 보고서를 생성하는 웹 애플리케이션.

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (http://localhost:5173)
npm run dev
```

## API 키 설정

Anthropic API 키가 필요합니다.

1. [Anthropic Console](https://console.anthropic.com/)에서 API 키를 발급받습니다.
2. 앱 좌측 하단 "파일 업로드" 패널을 열고 API 키 입력란에 붙여넣습니다.
3. 키는 브라우저 `localStorage`에 저장되어 새로고침 후에도 유지됩니다.

> **주의**: API 키는 클라이언트에서 직접 Anthropic API를 호출하는 데 사용됩니다.  
> 공용 PC나 공유 브라우저 사용 후에는 입력란을 비우세요.

## 사용 흐름

1. 좌측 "파일 업로드" 섹션에서 PDF 세금계산서를 드래그하거나 클릭으로 선택
2. **전체 분석 시작** 버튼을 누르면 순차 OCR 처리 시작 (진행률 오버레이 표시)
3. 처리 완료된 항목을 클릭하여 내용 확인 및 인라인 편집
4. 금액 불일치 시 빨간 셀 확인 → 수정 또는 ⚡ 자동 계산
5. **이 건 xlsx 저장** 또는 **전체 xlsx 일괄 저장**으로 엑셀 내보내기

## 빌드

```bash
# 프로덕션 빌드 → dist/
npm run build

# 빌드 결과 로컬 미리보기
npm run preview
```

## 기술 스택

| 역할 | 라이브러리 |
|---|---|
| UI 프레임워크 | React 19 + TypeScript + Vite |
| 스타일 | Tailwind CSS v3 |
| 상태 관리 | Zustand |
| PDF → 이미지 | pdfjs-dist v5 |
| OCR | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| 엑셀 생성 | ExcelJS v4 |
| 아이콘 | lucide-react |

## 주요 파일 구조

```
src/
├── components/
│   ├── HistoryPanel.tsx        # sessionStorage 처리 이력 패널
│   ├── InvoiceView.tsx         # 세금계산서 인라인 편집 뷰
│   └── UploadZone.tsx          # PDF 업로드 드롭존
├── hooks/
│   └── useInvoiceProcessor.ts  # OCR 순차 처리 / 재시도 / 진행률
├── pages/
│   └── MainPage.tsx            # 메인 레이아웃 (반응형 md 분기점)
├── store/
│   └── invoiceStore.ts         # Zustand 전역 상태
├── types/
│   └── invoice.ts              # InvoiceData 인터페이스
└── utils/
    ├── excelExporter.ts        # xlsx 내보내기 (단건/일괄 + 전체 요약 시트)
    ├── invoiceValidator.ts     # 금액 검증 + VAT 자동 계산
    ├── ocrParser.ts            # Claude API 호출 + JSON 파싱
    └── pdfToImages.ts          # PDF 페이지 → base64 PNG 변환
```
