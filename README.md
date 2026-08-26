# 우리집 재무관리

부부가 함께 보는 가계 재무 대시보드. 카드/계좌 거래내역을 엑셀에서 복사해 붙여넣으면
월별로 집계해서 보여준다.

## 로컬 실행

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 접속. 데이터는 프로젝트 폴더의 `data.db`에 저장된다.

## 테스트

```bash
npm test
```

## 배포 (Render 예시)

1. 이 저장소를 GitHub에 올린다.
2. Render 대시보드에서 "New Web Service" → 저장소 연결.
3. Build Command: `npm install`, Start Command: `npm start`.
4. **Disk** 탭에서 영구 디스크를 추가하고 마운트 경로를 예: `/data`로 지정한다.
5. 환경변수 `DB_PATH=/data/data.db`를 추가한다 (재배포해도 데이터가 유지되도록).
6. 배포 후 발급된 URL을 배우자와 공유한다.

## 범위 밖

카테고리 분류, 로그인, 은행/카드사 API 자동 연동은 다루지 않는다.
자세한 배경은 [설계 문서](docs/superpowers/specs/2026-08-26-household-finance-dashboard-design.md) 참고.
