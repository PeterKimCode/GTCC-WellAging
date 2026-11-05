# GTCC Institute for Well-Aging and Lifelong Health

원본 hyts_website의 레이아웃·메뉴·본문·사진·영상·상담·번역 기능을 그대로 복사한 독립 사이트입니다.
기관명과 로고, 헤더 영문 소속 표기, 언어 저장 키만 변경했습니다. 원본 CSS는 그대로 유지합니다.

## 로컬 실행
Node.js 20 이상: `npm run preview`

http://127.0.0.1:4173

## 검사
`npm ci` 후 `npm run check` (Python 3 필요).
상담 검사는 모의 응답만 사용하며 실제 접수하지 않습니다.
로컬 원본이 있으면 모든 HTML을 기관명 치환 결과와 비교하고 CSS 일치 여부를 검사합니다.

원본: https://github.com/PeterKimCode/hyts_website
참조 커밋: b1a350e64df3e6011a7e44a12c65ed25072d1014

기존 연락처·카카오·Web3Forms 설정을 유지했습니다. CNAME은 복사하지 않았고 배포하지 않았습니다.
로컬 .template-reference와 .previous-design 폴더는 Git에서 제외합니다.
