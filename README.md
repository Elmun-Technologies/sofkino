# 🎬 Telegram Kino Bot

Telegram orqali kinolarni boshqarish, ulashish va ko'rish uchun to'liq funksional bot.

## ✨ Xususiyatlar

### 👥 Foydalanuvchilar uchun:
- 🎬 **Janrlar bo'yicha kino qidirish** - Komediya, Drama, Aksiyon va boshqalar
- 🔑 **Kod orqali kino ochish** - Maxsus kodlar bilan kinolarni ochish
- 💎 **Premium obuna** - Maxsus kinolar va reklamasiz ko'rish
- 👤 **Profil** - Statistikangizni ko'rish
- 📰 **Yangiliklar** - Botdagi yangi kinolar haqida xabardor bo'lish

### 🔐 Admin uchun:
- ➕ **Kino qo'shish** - Videoni saqlash kanaliga yuborish, so'ng admin panelda kod/nom/tavsif to'ldirish
- ➕ **Janr qo'shish** - Wizard orqali oson qo'shish
- 📊 **Statistika** - Foydalanuvchilar va ko'rishlar soni
- 👥 **Foydalanuvchilar ro'yxati** - Oxirgi ro'yxatdan o'tganlar
- 📤 **Massoviy xabar yuborish** - Barchaga, faqat Premium yoki oddiy userlarga

## 🚀 O'rnatish

### 1. Paketlarni o'rnatish
```bash
npm install
```

### 2. Bot tokenini olish
1. Telegram'da `@BotFather` ga kiring
2. `/newbot` buyrug'ini yuboring
3. Bot nomini va username'ini kiriting
4. Token olasiz (masalan: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 3. `.env` faylini sozlash
`.env` faylini oching va quyidagilarni kiriting:
```env
BOT_TOKEN=sizning_bot_tokeningiz
ADMIN_ID=sizning_telegram_id
STORAGE_CHANNEL_ID=kinolar_saqlanadigan_private_kanal_id
```

**ADMIN_ID ni qanday topish mumkin?**
- `@userinfobot` ga `/start` yuboring, sizning ID'ingizni ko'rsatadi

**STORAGE_CHANNEL_ID ni qanday topish mumkin?**
- Bot'ni private kanalga administrator qilib qo'shing
- `STORAGE_CHANNEL_ID`ni hali sozlamasdan botni ishga tushiring va kanalga istalgan xabar yuboring
- Bot loglarida `STORAGE CHANNEL ID: -100...` qatorini toping va shu qiymatni `.env`ga yozing

### 4. Botni ishga tushirish
```bash
npm start
```

Yoki development rejimida:
```bash
npm run dev
```

## 📁 Loyiha Strukturasi

```
telegram-kino-bot/
├── src/
│   ├── config/
│   │   └── db.js              # Database ulanish va jadvallar
│   ├── controllers/
│   │   ├── movieController.js # Kino ko'rish va qidirish logikasi
│   │   ├── profileController.js # Profil ko'rsatish
│   │   └── premiumController.js # Premium obuna
│   ├── keyboards/
│   │   ├── mainMenu.js        # Asosiy menyu
│   │   └── adminMenu.js       # Admin menyu
│   ├── models/
│   │   ├── User.js            # User CRUD operatsiyalari
│   │   ├── Genre.js           # Janr boshqaruvi
│   │   └── Movie.js           # Kino boshqaruvi
│   ├── scenes/
│   │   ├── addGenreScene.js   # Janr qo'shish wizard
│   │   └── broadcastScene.js  # Xabar yuborish wizard
│   ├── utils/
│   │   └── auth.js            # Admin middleware
│   └── bot.js                 # Asosiy bot fayl
├── .env                       # Muhit o'zgaruvchilari
├── .gitignore
├── package.json
└── database.sqlite            # SQLite database (avtomatik yaratiladi)
```

## 🎯 Foydalanish

### Admin sifatida:
1. `/admin` buyrug'ini yuboring
2. Janr qo'shing (masalan: "Komediya", "Drama")
3. Kino qo'shing:
   - Video faylni `STORAGE_CHANNEL_ID` kanaliga yuboring (bot shu yerdan avtomatik oladi)
   - Admin panelda "⏳ Kutilayotgan videolar" ro'yxatida paydo bo'lgan videoni toping
   - "✅ Nashr qilish" tugmasi orqali nomi, tavsifi, janri va kodini kiriting

### Oddiy foydalanuvchi:
1. `/start` - Botni boshlash
2. `🎬 Kinolar` - Janrlar ro'yxatini ko'rish
3. `🔑 Kod kiritish` - Kod orqali kino topish
4. `💎 Premium Obuna` - Premium tariflarni ko'rish
5. `👤 Profil` - Statistikangizni ko'rish

## 🛠 Texnologiyalar

- **Node.js** - Backend runtime
- **Telegraf.js** - Telegram Bot Framework
- **better-sqlite3** - SQLite database
- **dotenv** - Environment variables
- **node-cron** - Cron jobs (kelajakda)

## 📊 Database Schema

### Users
- `telegram_id` - Foydalanuvchi ID (PK)
- `username` - Telegram username
- `full_name` - Ismi
- `is_premium` - Premium status
- `premium_end` - Premium tugash sanasi
- `joined_at` - Botga qo'shilgan sana

### Movies
- `id` - Kino ID (PK)
- `title` - Nomi
- `description` - Tavsif
- `genre_id` - Janr ID (FK)
- `file_id` - Telegram file ID
- `access_code` - Ochish kodi
- `views_count` - Ko'rilgan soni
- `is_premium_only` - Premium uchunmi

### Genres
- `id` - Janr ID (PK)
- `name` - Nomi

## 🔒 Xavfsizlik

- `.env` fayl gitignore qilingan
- Adminni faqat ADMIN_ID orqali aniqlash
- Database faqat server-side

## 📝 Keyingi bosqichlar

- [ ] Premium to'lov integratsiyasi (Click, Payme)
- [ ] Promokodlar tizimi
- [ ] Avtomatik premium tugashi tekshiruvi (CRON)
- [ ] Kino reytinglari
- [ ] Izohlar tizimi
- [ ] Inline mode qo'llab-quvvatlash

## 📧 Yordam

Muammolar yuzaga kelsa:
- Issues bo'limidan savol bering
- Admin bilan bog'laning

---

**Bot muvaffaqiyatli ishga tushgach, foydalanuvchilaringizga quvonch baxsh eting! 🎉**
