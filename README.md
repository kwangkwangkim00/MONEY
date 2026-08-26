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

## 배포 (Fly.io)

현재 https://woorijip-jaemu.fly.dev 에 배포되어 있다. Fly.io는 무료 한도 안에서
영구 볼륨(디스크)을 지원해서 `data.db`가 재배포해도 유지된다.

앱 코드를 바꾼 뒤 다시 배포하려면:

```bash
fly deploy --remote-only
```

(`fly` CLI가 로그인되어 있어야 한다. `fly auth login` 또는 `FLY_API_TOKEN` 환경변수 사용.)

설정 파일:
- `Dockerfile` — `fly launch`가 생성, `better-sqlite3` 네이티브 빌드 포함
- `fly.toml` — `/data`에 영구 볼륨 마운트, `DB_PATH=/data/data.db`로 연결
- 트래픽 없으면 머신이 자동으로 꺼졌다가(`auto_stop_machines`) 접속 시 다시 켜짐 (비용 절감)

## 범위 밖

카테고리 분류, 로그인, 은행/카드사 API 자동 연동은 다루지 않는다.
자세한 배경은 [설계 문서](docs/superpowers/specs/2026-08-26-household-finance-dashboard-design.md) 참고.
