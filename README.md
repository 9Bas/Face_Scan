# Face Scan · PSRU AI Face Search Gallery

เว็บรวมภาพกิจกรรมมหาวิทยาลัยพิบูลสงคราม — ผู้ใช้อัปโหลดรูปตัวเอง/เซลฟี่ แล้ว AI ค้นหาภาพที่ตรงกัน

---

## โปรเจกต์นี้คืออะไร (อ่านก่อนเลย ไม่ต้องเป็นคนเขียนโค้ด)

ระบบมีผู้ใช้ 2 ฝั่ง:

1. **ช่างภาพ** — ล็อกอินเข้ามา สร้างอัลบั้ม แล้วอัปโหลดรูปกิจกรรม (ทีละหลายร้อยรูปได้)
2. **ผู้เข้าชม** — เปิดเว็บ เลือกอัลบั้ม ดูรูป แล้ว**ค้นหารูปตัวเอง**ได้โดยแค่อัปโหลดรูปหน้าตัวเอง ระบบ AI จะหาว่ามีรูปไหนในอัลบั้มที่มีหน้าเราอยู่

**AI ทำงานยังไง (อธิบายง่ายๆ):** ตอนช่างภาพอัปโหลดรูป ระบบจะ "สแกน" หาใบหน้าในรูป แล้วแปลงใบหน้าแต่ละหน้าออกมาเป็น**รหัสตัวเลข 512 ตัว** (เรียกว่า embedding) เก็บลงฐานข้อมูล
เวลาผู้เข้าชมอัปโหลดรูปหน้าเพื่อค้นหา ระบบก็แปลงหน้าของเราออกมาเป็นรหัสตัวเลขแบบเดียวกัน แล้วไป**เทียบหารหัสที่ใกล้เคียงที่สุด** — ใครใกล้ที่สุด = หน้าน่าจะเป็นคนเดียวกัน รูปไหนที่ "ห่าง" เกินค่าที่กำหนด (threshold) ก็จะไม่เอามาแสดง

---

## สถานะของระบบ

| ส่วน | สถานะ | รายละเอียด |
|------|-------|-----------|
| 1 · หน้าเว็บ (Frontend) | ✅ เสร็จ | Home, Gallery, Album, Image Viewer, ค้นหาด้วยใบหน้า, Login + Dashboard ช่างภาพ |
| 2 · หลังบ้าน + Login + ฐานข้อมูล | ✅ เสร็จ | Supabase Auth / PostgreSQL + pgvector / RLS |
| 3 · AI ค้นหาใบหน้า | ✅ เสร็จ | FastAPI + InsightFace (ArcFace) — อัปโหลดรูปหน้า → ค้นหาคนที่คล้ายที่สุด |
| 4 · เก็บรูป | ✅ เสร็จ | Cloudflare R2 (bucket `face-scan-images`) ผ่าน Cloudflare Worker |
| 5 · Deploy จริง | 🟢 ใช้งาน | Frontend → Vercel · AI → Google Cloud Run · รูป → R2 ผ่าน Worker (ดูหัวข้อ Deploy) |

---

## เทคโนโลยีที่ใช้ (ทั้งหมดฟรี/โอเพนซอร์ส)

| ชิ้น | เทคโนโลยี | ใช้ทำอะไร |
|-----|----------|-----------|
| หน้าเว็บ | React + TypeScript + Vite + Tailwind CSS | UI ทั้งหมด (deploy ที่ Vercel) |
| ฐานข้อมูล + Login | Supabase (PostgreSQL + pgvector + Row Level Security + Auth) | ตารางข้อมูล, ระบบสมาชิก, ความปลอดภัย |
| เก็บไฟล์รูป | Cloudflare R2 (bucket `face-scan-images`) | เก็บรูปต้นฉบับ + thumbnail (ฟรี 10GB/เดือน) |
| ตัวกลาง (Gateway) | Cloudflare Worker (`https://cs.face-scan-r2.workers.dev`) | อัปโหลด / ลบ / เปิดดูรูปใน R2 อย่างปลอดภัย (ตรวจสิทธิ์ด้วย JWT ของ Supabase) |
| AI ค้นใบหน้า | Python + FastAPI + InsightFace (Model Pack buffalo_l — โมเดล w600k_r50, ArcFace loss) | ตรวจจับใบหน้า + เปลี่ยนใบหน้าเป็นตัวเลข 512 มิติ + ค้นหาคนที่คล้ายที่สุด (deploy ที่ Google Cloud Run) |

> เปิดดูรูป (public view) ผ่าน Worker `/view` — ระบบรองรับหลายตัวเลือกที่เก็บรูปในคราวเดียว: `src/lib/storage/` มีทั้ง **R2 ผ่าน Worker** (ใช้จริงตอนนี้), **Supabase Storage** (สำรอง), และ **mock** (เทสต์ UI แบบไม่ต้องมีบัญชี)

---

## เริ่มต้นใช้งาน (สำหรับนักพัฒนา)

### ขั้นตอนที่ 1 — เปิดหน้าเว็บ (Frontend)

```powershell
cd D:\Demo_Projects\Face_Scan
npm install        # ติดตั้งครั้งแรก
npm run dev        # เปิดเว็บที่ http://localhost:5173
```

> ถ้ายังไม่ได้ตั้งค่า `.env` → ระบบจะใช้ **mock mode** (login ด้วยอะไรก็ได้, รูปตัวอย่างจาก picsum.photos) เหมาะสำหรับลองดู UI ก่อน

### ขั้นตอนที่ 2 — เปิดตัว AI (Backend) — จำเป็นถ้าอยากให้ "ค้นหาใบหน้า" ทำงานจริง

```powershell
cd D:\Demo_Projects\Face_Scan\backend

# สร้างพื้นที่ของ Python (ครั้งแรก)
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell
# บน Mac/Linux ใช้: source .venv/bin/activate

pip install -r requirements.txt

# ตั้งค่าตัวแปร: คัดลอก .env.example เป็น .env แล้วใส่ค่า (ดูหัวข้อถัดไป)
copy .env.example .env          # Windows
# บน Mac/Linux ใช้: cp .env.example .env

uvicorn app.main:app --reload   # เปิด AI ที่ http://localhost:8000
```

ตรวจว่าทำงาน: เปิด `http://localhost:8000/api/faces/health` ควรเห็น `{"status":"ok"}`

> ครั้งแรกที่เปิด ระบบจะดาวน์โหลดโมเดล AI อัตโนมัติ (~280MB) จึงอาจช้าไปสักพัก
> ขณะทดสอบ ต้องเปิด **ทั้งเว็บและ AI พร้อมกัน** — หน้าเว็บจะส่งงานค้นหาไปให้ AI ที่พอร์ต 8000 ผ่าน proxy ที่ตั้งไว้ใน `vite.config.ts` (อ่านจาก `VITE_FACE_API_URL` ค่าเริ่มต้น `http://localhost:8000`)

### ตัวแปรที่ต้องใส่ใน `backend/.env`

| ชื่อ | ความหมาย |
|-----|----------|
| `SUPABASE_URL` | URL ของโปรเจกต์ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **คีย์ลับ** ใช้ฝั่ง server เท่านั้น อย่าใส่ในเว็บ |
| `SUPABASE_ANON_KEY` | คีย์สาธารณะ สำหรับโหลดรูปจาก Storage (กรณีไม่ใช้ R2) |
| `FACE_MATCH_MAX_DISTANCE` | ค่าความคล้ายสูงสุดที่ยอมรับ (ยิ่งน้อยยิ่งเคร่ง) ค่าเริ่มต้น 0.6 |
| `FACE_TOP_K` | จำนวนผลลัพธ์สูงสุดที่คืน ค่าเริ่มต้น 30 |
| `R2_WORKER_URL` | URL ของ Cloudflare Worker (เช่น `https://cs.face-scan-r2.workers.dev`) — ใช้โหลดรูปจาก R2 และอัปโหลด thumbnail |
| `R2_THUMB_API_KEY` | คีย์ลับที่ backend ใช้เขียน thumbnail กลับเข้า R2 (ต้องตรงกับ `THUMB_API_KEY` ของ Worker) |
| `INDEX_API_KEY` | รหัสลับสำหรับเรียก /index (ว่าง = เปิดใน dev) |

---

## ตั้งค่าใช้จริง (Supabase)

### 1. สร้าง Project
สมัครที่ https://supabase.com (ฟรี) → สร้าง project ใหม่ → คัดลอก **Project URL** + **anon/publishable key** ไปใส่ใน `.env`

### 2. รัน Database Migration
ไปที่ Supabase Dashboard → **SQL Editor** → รันตามลำดับ:
- เนื้อหา `supabase/migrations/0001_init.sql` (ตาราง + RLS)
- เนื้อหา `supabase/migrations/0003_photo_faces.sql` (ตารางหน้า + pgvector + ฟังก์ชันค้นหา)

> หมายเหตุ: migration 0002 ถูกลบแล้ว (schema เก่าที่ถูก 0003 ทดแทน) ให้รันแค่ 0001 กับ 0003

### 3. ตั้งค่า RLS + GRANT (ทำครั้งเดียว หลัง migration)
รันใน SQL Editor:

```sql
grant all on public.albums to authenticated;
grant select on public.albums to anon;
grant all on public.photos to authenticated;
grant select on public.photos to anon;
grant all on public.profiles to authenticated;
grant select on public.profiles to anon;
grant usage, select on all sequences in schema public to anon, authenticated;

alter table public.profiles force row level security;
alter table public.albums force row level security;
alter table public.photos force row level security;

create or replace function public.get_my_profile()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare rec public.profiles%rowtype;
begin
  select * into rec from public.profiles where id = auth.uid();
  if rec.id is null then
    insert into public.profiles (id, email, display_name, role)
    select auth.uid(), u.email, coalesce(u.raw_user_meta_data->>'display_name', u.email), 'photographer'
    from auth.users u where u.id = auth.uid()
    on conflict (id) do nothing
    returning * into rec;
  end if;
  return rec;
end;
$$;
grant execute on function public.get_my_profile() to authenticated, anon;
```

### 4. ปิด Email Confirmation (ถ้าต้องการ login ทันที)
Dashboard → Authentication → Providers → Email → ปิด "Confirm email"

### 5. สร้าง Storage Bucket ชื่อ `photos` (เปิด Public)
Dashboard → Storage → New bucket → ชื่อ `photos` → Public: ✅ แล้วรัน policy นี้:

```sql
drop policy if exists "photos_public_read" on storage.objects;
drop policy if exists "photos_authenticated_upload" on storage.objects;
drop policy if exists "photos_owner_update" on storage.objects;
drop policy if exists "photos_owner_delete" on storage.objects;

create policy "photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

create policy "photos_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

create policy "photos_owner_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

create policy "photos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos');
```

### 6. สร้างบัญชีช่างภาพ
ระบบ**ไม่มีปุ่มสมัครเอง** — ช่างภาพได้บัญชีจากแอดมินเท่านั้น:
Dashboard → Authentication → Users → Add user → กรอก email + password → สร้าง (ระบบสร้างข้อมูลช่างภาพให้อัตโนมัติ) → ล็อกอินที่ `/login`

### 7. ตั้งค่า `.env` ฝั่งเว็บ
คัดลอก `.env.example` → `.env` แล้วใส่ค่า:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...publishable...
VITE_WORKER_URL=https://cs.face-scan-r2.workers.dev   # URL ของ Cloudflare Worker (ถ้ามี → ใช้ R2 เก็บรูปทันที)
VITE_FACE_API_URL=http://localhost:8000               # URL AI backend (ตอน dev ใช้ proxy ของ Vite)
VITE_FACE_INDEX_API_KEY=                              # ตรงกับ INDEX_API_KEY ฝั่ง backend (ถ้ามี)
```

---

## หลังอัปโหลดรูปแล้ว (การทำดัชนีใบหน้า)

พอช่างภาพอัปโหลดรูปเสร็จ หน้าเว็บจะส่งรูปให้ AI สแกนใบหน้าและสร้าง **thumbnail** ให้อัตโนมัติ (แบบไฟร์แอนด์ฟอร์เก็ต)
ถ้าขั้นตอนนั้นพลาด (เช่น Cloud Run หลับตัวตอนอัปโหลด) backend มี **background sweeper** ไล่สแกนรูปที่ยังไม่มี thumbnail เองทุก 60 วินาที (ตั้งได้ที่ `INDEX_SWEEP_INTERVAL_SECONDS`)

ถ้าต้องการ**สแกนใหม่ทั้งคลัง** หรือมีรูปที่ยังไม่ถูกสแกน ใช้สคริปต์ได้:

```powershell
cd D:\Demo_Projects\Face_Scan\backend
python -m scripts.reindex_faces              # สแกนทุกอัลบั้ม
python -m scripts.reindex_faces --album-id <uuid>   # เฉพาะอัลบั้ม
python -m scripts.reindex_faces --force      # บังคับสแกนใหม่ทั้งหมด
python -m scripts.backfill_thumbs            # สร้าง thumbnail ที่ขาดหาย (สำรองของ sweeper)
```

---

## Security

- ✅ **RLS ทุกตาราง** — ช่างภาพเห็น/แก้ได้เฉพาะข้อมูลของตัวเอง (บังคับที่ระดับฐานข้อมูล)
- ✅ **Service Role Key อยู่ฝั่ง server เท่านั้น** — ไม่อยู่ในโค้ดหน้าเว็บ
- ✅ **envGuard** — เว็บตรวจตอนเปิดว่าไม่มีคีย์ลับหลุดเข้าไปใน bundle
- ✅ **ฟังก์ชัน `get_my_profile`** — ข้าม RLS แค่สำหรับข้อมูลตัวเอง (security definer)

---

## Build & Deploy (การขึ้นใช้งานจริง)

ปัจจุบันระบบนี้ deploy เป็น 3 ชิ้น:

### 1. หน้าเว็บ (Frontend) → **Vercel**
```powershell
cd D:\Demo_Projects\Face_Scan
npm run build       # ได้ไฟล์ใน dist/
npx tsc -b          # ตรวจ TypeScript
npm run lint        # ตรวจโค้ด (oxlint)
```
- โครงการ Vercel ชื่อ **face-scan** (ลิงก์โฟลเดอร์ `D:\Demo_Projects\Face_Scan`)
- มี `vercel.json` ตั้ง SPA rewrite ให้ทุกเส้นทางไป `/index.html` (ใช้ BrowserRouter — URL สวย ไม่มี #)
- ไป set env vars ที่ Vercel Dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKER_URL`, `VITE_FACE_API_URL` (URL ของ Cloud Run จริง)

### 2. AI Backend → **Google Cloud Run** (service `face-scan-api` · region `asia-southeast3`)
```powershell
deploy-cloudrun.bat     # หรือ deploy.bat / deploy2.bat
```
- สเปก: CPU 2 / RAM 4Gi / port 8000 / min 1 instance (กัน Cold Start ตอนสแกน) / max 10
- โมเดล `FACE_PACK=buffalo_l` + `OMP_NUM_THREADS=2`
- รันสแกน/ค้นหาใบหน้า ผ่านเซอร์วิสนี้ ส่วนรูปโหลดจาก R2 (`R2_WORKER_URL`) แล้วเขียน thumbnail กลับด้วย `R2_THUMB_API_KEY`
- มี `cloudbuild.yaml` สำหรับ auto-deploy จาก Git (Cloud Build → Cloud Run) และ `railway.json` + `Dockerfile` รอรับ Railway เป็นทางเลือก

### 3. ที่เก็บรูป → **Cloudflare R2 + Worker** (gateway)
```powershell
cd D:\Demo_Projects\Face_Scan\worker
wrangler login
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put THUMB_API_KEY
wrangler deploy      # อัปโหลด worker ขึ้น https://cs.face-scan-r2.workers.dev
```
- Worker ใช้ R2 binding ชื่อ `BUCKET` (bucket `face-scan-images`) — จุดเชื่อม: `POST /upload`, `DELETE /delete`, `POST /upload-thumb`, `GET /view?path=...`
- เปิดดูรูปของคนทั่วไปผ่าน `/view` ส่วนอัปโหลด/ลบต้องส่ง JWT ของ Supabase (สิทธิ์มาจาก RLS บนฐานข้อมูล)

---

## โครงสร้างไฟล์

```
Face_Scan/
├── src/                        # หน้าเว็บ (React + TypeScript)
│   ├── lib/                    # ตัวติดต่อ: Supabase, Storage, AI, ประเภทข้อมูล
│   │   └── storage/            # ตัวเลือกที่เก็บรูป: r2Storage (ใช้จริง) / supabaseStorage / mock
│   ├── components/             # ส่วนประกอบ UI (Header, Gallery, Dashboard...)
│   ├── pages/                  # หน้าเว็บ (Home, Gallery, Album, Login, Dashboard*)
│   └── App.tsx / main.tsx      # จุดเริ่มของเว็บ + เส้นทางหน้า
├── backend/                    # ตัว AI (Python + FastAPI)
│   ├── app/
│   │   ├── main.py             # จุดเริ่ม AI + background sweeper (thumbnail)
│   │   ├── face_engine.py      # ตรวจจับ/แปลงใบหน้าเป็นตัวเลข (InsightFace)
│   │   ├── routes_faces.py     # API: index / search / health
│   │   ├── indexer.py          # ตรรกะสแกนหน้า + สร้าง thumbnail + sweeper
│   │   ├── image_io.py         # โหลด/ย่อ/เข้ารหัสรูป (thumbnail)
│   │   ├── supabase_client.py  # ติดต่อ Supabase + ดึงรูป/เขียน thumbnail ไป R2
│   │   └── config.py           # ค่าตั้งค่า (threshold, R2, ขนาด, ฯลฯ)
│   ├── scripts/                # reindex_faces.py (สแกนใหม่) + backfill_thumbs.py
│   ├── tests/                  # เทสต์ identity (ต้องรัน backend จริง)
│   └── requirements.txt
├── worker/                     # Cloudflare Worker ทำหน้าที่เป็นประตูเข้า R2
│   ├── src/index.js            # /upload, /delete, /upload-thumb, /view
│   ├── wrangler.toml           # เชื่อม bucket R2 ชื่อ face-scan-images
│   └── package.json
├── supabase/migrations/        # คำสั่งสร้างฐานข้อมูล (รันทีละไฟล์)
│   ├── 0001_init.sql           # ตาราง + RLS
│   ├── 0003_photo_faces.sql    # ตารางหน้า + pgvector + ฟังก์ชันค้นหา
│   └── 0004_fix_table_grants.sql  # แก้ GRANT/Policy ให้เขียนข้อมูลได้
├── deploy*.bat                 # สคริปต์ deploy ขึ้น Cloud Run
├── cloudbuild.yaml             # CI: Build + Push + Deploy ไป Cloud Run
├── Dockerfile / railway.json   # ทางเลือก deploy AI ผ่าน Railway
└── vercel.json                 # SPA rewrite สำหรับ Vercel
```

---

  ## สิ่งที่วางแผนไว้ (Roadmap)

  > ปัจจุบันใช้อยู่แล้ว: **Cloudflare R2** ผ่าน Worker (เก็บรูปจริงเป็นหลัก) · **thumbnail** อัตโนมัติ (sweeper + backfill) · migration 0004 แก้ GRANT/RLS · deploy สามชั้น Vercel + Cloud Run + R2 Worker
