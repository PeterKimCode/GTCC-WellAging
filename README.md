# GTCC Institute for Well-Aging and Lifelong Health

치매 돌봄·건강관리·보호자 지원을 위한 안내 사이트입니다. 원본 템플릿의 헤더, 아이콘 메뉴, 배너, 상담 카드와 하단 2×2 배치는 유지합니다.
원본의 교육·종교 원고와 영상, 인물 사진은 공개 페이지에서 사용하지 않습니다.
배너와 돌봄 이미지는 AI로 만든 연출 이미지이며 실제 시설·환자의 사진이 아닙니다.

## 실행과 수정
Node.js 20 이상에서 `npm run preview` → http://127.0.0.1:4173

- 원고: content/site.json
- 공통 화면 배치: templates/site.html
- 생성: `node scripts/build-site.cjs`
- 검증: `npm ci` 후 `npm run check` (Python 3 필요)
- 호환성 유지를 위해 기존 URL 파일명은 유지합니다.
- 기존 연락처·카카오·Web3Forms 수신 설정은 유지했습니다. 담당 인력·의료 서비스·시설·비용 등 미확인 정보는 임의로 기재하지 않았습니다.
- 실제 상담 메시지는 자동 검증에서 전송하지 않습니다.

## 공개 주소
https://peterkimcode.github.io/GTCC-WellAging/
공개 저장소 main 브랜치에서 GitHub Pages로 배포합니다.

템플릿 출처: https://github.com/PeterKimCode/hyts_website
로컬 .template-reference 및 .previous-design 폴더는 Git에서 제외됩니다.
