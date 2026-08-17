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
| 1 · หน้าเว็บ (Frontend) | ✅ เสร็จ | Home, Gallery, Album, Image Viewer, ค้นหาด้วยใบหน้า, Login |
| 2 · หลังบ้าน + Login + เก็บรูป | ✅ เสร็จ | Supabase Auth / ฐานข้อมูล / RLS / Storage + Dashboard ช่างภาพ |
| 3 · AI ค้นหาใบหน้า | ✅ เสร็จ | อัปโหลดรูปหน้า → AI ค้นหารูปที่ตรง (ArcFace) |

---

## เทคโนโลยีที่ใช้ (ทั้งหมดฟรี/โอเพนซอร์ส)

| ชิ้น | เทคโนโลยี | ใช้ทำอะไร |
|-----|----------|-----------|
| หน้าเว็บ | React + TypeScript + Vite + Tailwind CSS | UI ทั้งหมด |
| ฐานข้อมูล + Login + เก็บรูป | Supabase (PostgreSQL + pgvector + Row Level Security + Storage) | ตารางข้อมูล, ระบบสมาชิก, ความปลอดภัย, เก็บไฟล์รูป |
| AI ค้นใบหน้า | Python + FastAPI + InsightFace (ArcFace R100) | ตรวจจับใบหน้า + เปลี่ยนใบหน้าเป็นตัวเลข 512 มิติ + ค้นหาคนที่คล้ายที่สุด |

> หมายเหตุ: ตอนนี้เก็บรูปใน Supabase Storage (ฟรี 1GB) มีโค้ดเตรียมรองรับการย้ายไป Cloudflare R2 ไว้แล้ว (ดูหัวข้อ "สิ่งที่วางแผนไว้") แต่ยังไม่ได้ต่อใช้งาน

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
| `SUPABASE_ANON_KEY` | คีย์สาธารณะ สำหรับโหลดรูปจาก Storage |
| `FACE_MATCH_MAX_DISTANCE` | ค่าความคล้ายสูงสุดที่ยอมรับ (ยิ่งน้อยยิ่งเคร่ง) ค่าเริ่มต้น 0.6 |
| `FACE_TOP_K` | จำนวนผลลัพธ์สูงสุดที่คืน ค่าเริ่มต้น 30 |
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
```

---

## หลังอัปโหลดรูปแล้ว (การทำดัชนีใบหน้า)

ปกติพอช่างภาพอัปโหลดรูปเสร็จ หน้าเว็บจะส่งรูปให้ AI สแกนใบหน้าให้อัตโนมัติ (แบบไฟร์แอนด์ฟอร์เก็ต)
แต่ถ้าต้องการ**สแกนใหม่ทั้งคลัง** หรือมีรูปที่ยังไม่ถูกสแกน ใช้สคริปต์นี้ได้:

```powershell
cd D:\Demo_Projects\Face_Scan\backend
python -m scripts.reindex_faces              # สแกนทุกอัลบั้ม
python -m scripts.reindex_faces --album-id <uuid>   # เฉพาะอัลบั้ม
python -m scripts.reindex_faces --force      # บังคับสแกนใหม่ทั้งหมด
```

---

## Security

- ✅ **RLS ทุกตาราง** — ช่างภาพเห็น/แก้ได้เฉพาะข้อมูลของตัวเอง (บังคับที่ระดับฐานข้อมูล)
- ✅ **Service Role Key อยู่ฝั่ง server เท่านั้น** — ไม่อยู่ในโค้ดหน้าเว็บ
- ✅ **envGuard** — เว็บตรวจตอนเปิดว่าไม่มีคีย์ลับหลุดเข้าไปใน bundle
- ✅ **ฟังก์ชัน `get_my_profile`** — ข้าม RLS แค่สำหรับข้อมูลตัวเอง (security definer)

---

## Build & Deploy

### หน้าเว็บ (Frontend)
```powershell
npm run build       # ได้ไฟล์ใน dist/
npx tsc -b          # ตรวจ TypeScript
npm run lint        # ตรวจโค้ด
```
นำ `dist/` ไปขึ้นบน Vercel / Netlify / Cloudflare Pages (ตั้ง env vars ให้ครบ)

### ตัว AI (Backend)
ในโฟลเดอร์ `backend/` มี `Dockerfile` พร้อมแล้ว:
```powershell
cd D:\Demo_Projects\Face_Scan\backend
docker build -t face-scan-ai .
docker run -p 8000:8000 --env-file .env face-scan-ai
```
เวลา deploy จริง ต้องตั้ง reverse proxy (เช่น nginx) ให้ส่ง `/api` ไปที่ backend นี้ หรือแก้ `VITE_FACE_API_URL` ให้ชี้ไป URL จริง

---

## โครงสร้างไฟล์

```
Face_Scan/
├── src/                        # หน้าเว็บ (React + TypeScript)
│   ├── lib/                    # ตัวติดต่อ: Supabase, Storage, AI, ประเภทข้อมูล
│   ├── components/             # ส่วนประกอบ UI (Header, Gallery, Dashboard...)
│   ├── pages/                  # หน้าเว็บ (Home, Gallery, Album, Login, Dashboard*)
│   └── App.tsx / main.tsx      # จุดเริ่มของเว็บ + เส้นทางหน้า
├── backend/                    # ตัว AI (Python + FastAPI)
│   ├── app/
│   │   ├── main.py             # จุดเริ่ม AI
│   │   ├── face_engine.py      # ตรวจจับ/แปลงใบหน้าเป็นตัวเลข (InsightFace)
│   │   ├── routes_faces.py     # API: index / search / health
│   │   ├── supabase_client.py  # ติดต่อ Supabase (คีย์ลับอยู่ตรงนี้)
│   │   └── config.py           # ค่าตั้งค่า (threshold, ขนาด, ฯลฯ)
│   ├── scripts/reindex_faces.py  # สคริปต์สแกนใบหน้าใหม่ทั้งคลัง
│   ├── tests/                  # เทสต์ identity (ต้องรัน backend จริง)
│   └── requirements.txt / Dockerfile
├── supabase/migrations/        # คำสั่งสร้างฐานข้อมูล (รันทีละไฟล์)
│   ├── 0001_init.sql
│   └── 0003_photo_faces.sql
└── src/lib/storage/            # ตัวเลือกที่เก็บรูป (Supabase / mock / R2-สำรอง)
```

---

## สิ่งที่วางแผนไว้ (Roadmap)

- **คัดกรองภาพคุณภาพต่ำตอนอัปโหลด** — ภาพเบลอ / หลับตา / ถูกบัง จะถูกแจ้งสาเหตุและไม่ถูกอัปโหลด (เหมาะกับช่างภาพที่ถ่ายรัว)
- **การประเมินผลความแม่นยำ** — คำนวณ Precision@k / Recall@k จากชุดข้อมูลจริง เพื่อหาค่า threshold ที่ดีที่สุด
- **Pagination + thumbnail จริง** — โหลดเว็บเร็วขึ้นเมื่อมีรูปเยอะ
- **ย้ายรูปไป Cloudflare R2** — มีโค้ดรองรับใน `src/lib/storage/r2Storage.ts` แล้ว ยังไม่ได้เชื่อมต่อ
