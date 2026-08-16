// 후보 글들의 실제 분량/이미지/민감여부만 측정 (파일 생성 X)
const NOTION = "https://giho.notion.site";
const SENSITIVE = /asurion|어슈리온|\bskt\b|쿼리파이|queryfi|dbfence|주민등록|계좌번호|리니지|AKIA[0-9A-Z]{12,}|-----BEGIN|password\s*[:=]\s*[^\s{}]/i;

const CANDS = [
  ["2ef3d039-df65-8022-8964-efe617bd70e8", "Mac 초기 세팅 flow"],
  ["2393d039-df65-80aa-b238-cafff4319914", "Azure Managed SQL DMS CDC"],
  ["1933d039-df65-8025-981d-c8b0bf002e1f", "파티션"],
  ["1143d039-df65-808a-bd1a-dd40b5f1e8ff", "compile C/C++ on Mac"],
  ["10a3d039-df65-8082-8ba8-ff4b156ea687", "Airflow Tutorial"],
  ["2c9e8840-7025-4da7-9f37-332286620d6a", "MySQL 5.7 Orphan table"],
  ["570434f9-ef00-41d6-ad92-8330a3d79fbc", "DynamoDB logging"],
  ["4c6776f1-af59-4ec8-9053-a3e6687dcf6e", "RSA public key error"],
  ["ae8c774e-dbdb-434b-ad72-c7e8437ed9f8", "MySQL 계정 정보 모를 때"],
  ["672f21f8-755f-4fc6-9fa8-e73133298585", "NoSQL 기술 동향"],
  ["eff124ea-9d18-46b0-9f54-5dfb688c0fec", "[MySQL 성능최적화] 02 모니터링"],
  ["a90a7684-4851-4ed0-af09-b5ae5b9e1b67", "Mojo"],
  ["6cbcd062-dc2b-4108-bee6-4020f04d09bb", "SQL Server 트랜잭션 격리수준"],
  ["8f35ff57-563e-4020-abce-4aeaa14a8aeb", "SQL Server 시작하기"],
  ["6e8f6ce3-9572-4a0a-95fe-384bee0564ed", "MySQL Lock & general log"],
  ["d4e8652a-dce5-4e62-900a-4914b09cdce5", "selenium 크롤링 팁"],
  ["ebf6245b-118a-4188-8fb8-7aa2cdb68e69", "이기종 DB 링크 파이썬 구현"],
  ["073b2891-a67a-4ef9-a87f-4c37d6088ffb", "자주 만나는 에러 정리"],
  ["5406141d-8497-4101-b99f-383ffc3cc4f3", "DataFrame column 추가"],
  ["9bdb3323-e2f5-4dbf-a668-39c086d499fd", "MySQL Monitoring"],
  ["10b3d039-df65-8070-996a-f6b037a69612", "RDS start export task"],
  ["10a3d039-df65-80df-849d-d78c1cfdcdb3", "Pytest"],
  ["98ff335b-eaa3-4c09-a9ba-5d69172398df", "13만건 insert"],
  ["4922b591-7cc0-4e77-a180-4ca735fa7d01", "TS: error 168 storage engine"],
  ["f6519d30-55e6-45fc-8576-a8f0703c6153", "airflow"],
  ["547f8f54-f5ad-469d-b8f4-b71d6ce18086", "데이터 파일로 내보내기"],
  ["b4998a03-c20c-4ddc-8e26-793d6330d2f4", "시스템 변수"],
  ["55712896-5945-4c1f-96d5-b55b27b61db4", "슬레이브 마스터 변경 스크립트"],
  ["37292e30-6313-4e31-be26-9b27eaeedd83", "JSON column type"],
  ["6db31c83-c425-4a4c-85e6-3e2d509f0abb", "minikube + podman"],
  ["1793d039-df65-8002-94d9-da8afaf0ed83", "Tmux Settings"],
  ["61acbf75-41ec-4292-8962-393bc28a08b1", "Neovim"],
  ["8283f7d4-1d82-4458-8c1a-7a0456404431", "UUID"],
  ["37292e30-6313-4e31-be26-9b27eaeedd83", "JSON column type"],
];

const unwrap = e => { let v = e?.value ?? e; while (v && v.value && (v.role || v.spaceId) && !v.type) v = v.value; return v; };
const rich = a => Array.isArray(a) ? a.map(s => s[0] ?? "").join("") : "";

async function probe(id) {
  const res = await fetch(NOTION + "/api/v3/loadPageChunk", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ pageId: id, limit: 200, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
  });
  if (!res.ok) return { chars: -1, imgs: 0, sens: false };
  const data = await res.json();
  let text = "", imgs = 0;
  for (const [, entry] of Object.entries(data.recordMap.block || {})) {
    const b = unwrap(entry);
    if (!b) continue;
    if (b.type === "image") imgs++;
    text += rich(b.properties?.title) + " ";
    if (b.type === "code") text += (b.properties?.title || []).map(s => s[0]).join("");
  }
  const plain = text.replace(/\s+/g, "").length;
  return { chars: plain, imgs, sens: SENSITIVE.test(text) };
}

const rows = [];
for (const [id, title] of CANDS) {
  try { const r = await probe(id); rows.push([r.chars, r.imgs, r.sens, title, id]); }
  catch { rows.push([-1, 0, false, title, id]); }
}
rows.sort((a, b) => b[0] - a[0]);
console.log("chars  imgs  flag  title");
for (const [c, i, s, t] of rows) {
  console.log(`${String(c).padStart(5)}  ${String(i).padStart(3)}   ${s ? "⚠️ " : "  "}   ${t}`);
}
