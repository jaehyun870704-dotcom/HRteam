# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**임금결의서** — 한국어 문서(임금결의서 등)를 스캔/촬영 이미지로부터 OCR로 텍스트를 추출하고, 품질을 검증한 뒤 Excel 보고서로 출력하는 자동화 워크플로우.

## 에이전트 구조

세 개의 전문 서브에이전트가 파이프라인을 구성한다:

### 1. `ocr` (빨강)
이미지에서 한국어 텍스트를 추출. 적응형 이진화, 기울기 보정, 그림자 제거 등 전처리 후 딥러닝 기반 문자 인식을 수행. **숫자 정확도가 최우선**이며, 확신하지 못하는 숫자는 `[UNCERTAIN: X or Y]`로 표기한다.

### 2. `ocr-quality-validator` (파랑)
OCR 결과를 5단계로 검증:
1. 신뢰도 분석 (기본 임계값 85%)
2. 라인 이탈 검사
3. 영역 침범 검사
4. 맞춤법·띄어쓰기 교정 (한글 맞춤법 기준)
5. 개체명 무결성 검사 — **날짜/시간 개체는 검증 생략**

### 3. `excel-report-generator` (초록)
검증된 데이터를 `openpyxl` 또는 `xlsxwriter`로 `.xlsx` 파일 생성. 한국어 날짜 형식(YYYY년 MM월 DD일), 원화(₩) 포맷, 병합 셀 등을 지원.

## 에이전트 메모리 경로

각 에이전트는 독립적인 프로젝트 범위 메모리를 유지한다:
- `.claude/agent-memory/ocr/`
- `.claude/agent-memory/ocr-quality-validator/`
- `.claude/agent-memory/excel-report-generator/`

## 전형적인 작업 흐름

1. 이미지 입력 → `ocr` 에이전트로 텍스트 추출
2. 추출 결과 → `ocr-quality-validator`로 품질 검증 및 교정
3. 교정된 데이터 → `excel-report-generator`로 보고서 생성
