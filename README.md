# GTCC Institute for Well-Aging and Lifelong Health

노인학·웰에이징·평생건강을 중심으로 한 연구소와 노인학 아카데미 안내 사이트입니다.
부설 연구소장: 이성종 박사. 사용자가 제공한 사진·이력·저자 소개를 바탕으로 인사말과 학력·경력·저서·자격을 구성했습니다.
인사말은 제공된 교육철학을 바탕으로 작성한 홈페이지용 원고입니다. 교육철학 명예박사와 노인학 박사를 구분하며, 백석대 졸업 시점은 제공 자료의 월 표기가 달라 연도만 표시했습니다.
학력 증명서 및 이력서의 원본 이미지는 공개 저장소에 넣지 않았고, 생년월일·증명서 식별번호도 공개하지 않습니다.
기존 템플릿의 헤더·아이콘 메뉴·배너·상담 카드·하단 배치를 유지합니다.
연구소장 사진은 사용자가 제공한 원본이며, 배너는 AI로 만든 연구·학습 관련 연출 이미지입니다.

## 실행과 수정
Node.js 20 이상에서 `npm run preview` → http://127.0.0.1:4173

- 원고: content/site.json / 공통 화면: templates/site.html
- 생성: `node scripts/build-site.cjs`
- 검증: `npm ci` 후 `npm run check` (Python 3 필요)
- 호환성을 위해 기존 URL 파일명을 유지합니다.
- 온라인 교재실: online-textbooks.html. 상단 메뉴와 자료·소식에서 연결합니다.
- 온라인 교재실은 데스크톱 4열×2행의 예시 교재 8권과 개별 예시 본문 페이지로 구성했습니다. 표지는 직접 작성한 SVG이며 제목·저자·본문은 예시임을 표시합니다.
- 실제 교재·강좌 일정·참가비는 미제공 상태입니다. 예시 원고는 실제 발행 교재나 확정 자료가 아닙니다.
- 기존 연락처·카카오·Web3Forms 수신 설정을 유지합니다. 자동 검증에서는 실제 문의를 보내지 않습니다.
- 진료·입원 안내 사이트가 아닌 연구·교육 안내 사이트입니다.

## 공개 주소
https://peterkimcode.github.io/GTCC-WellAging/
공개 저장소 main 브랜치에서 GitHub Pages로 배포합니다.
템플릿 출처: https://github.com/PeterKimCode/hyts_website
로컬 .template-reference 및 .previous-design 폴더는 Git에서 제외됩니다.
