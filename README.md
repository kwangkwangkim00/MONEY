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

> **주의:** 데이터를 안전하게 보관하려면 유료 인스턴스(Starter 이상)가 필요하다.
> Render의 무료(Free) 티어는 영구 디스크를 지원하지 않고, 비활성 상태가 되면
> 서비스가 슬립되며 재시작/재배포 시 `data.db`가 초기화되어 그동안의 거래
> 내역이 전부 사라진다. 무료 티어로 배포하면 이 앱은 실질적으로 데이터를
> 보관할 수 없다.

1. 이 저장소를 GitHub에 올린다.
2. Render 대시보드에서 "New Web Service" → 저장소 연결.
3. Instance Type을 **Starter 이상 유료 플랜**으로 선택한다 (Free 플랜은 4번의
   영구 디스크를 추가할 수 없다).
4. Build Command: `npm install`, Start Command: `npm start`.
5. **Disk** 탭에서 영구 디스크를 추가하고 마운트 경로를 예: `/data`로 지정한다.
6. 환경변수 `DB_PATH=/data/data.db`를 추가한다 (재배포해도 데이터가 유지되도록).
7. 배포 후 발급된 URL을 배우자와 공유한다.

## 범위 밖

카테고리 분류, 로그인, 은행/카드사 API 자동 연동은 다루지 않는다.
자세한 배경은 [설계 문서](docs/superpowers/specs/2026-08-26-household-finance-dashboard-design.md) 참고.
