// ============================================================
//  نظام القبول والتسجيل - Server Side
//  Internet Applications Programming Project
//  المكتبات المستخدمة: Express, SQLite3, CORS
// ============================================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());                        // السماح بالطلبات من الـ client
app.use(express.json());                // قراءة بيانات JSON من الـ client
app.use(express.static(__dirname));     // خدمة ملفات الـ HTML


// ── إنشاء / فتح قاعدة البيانات ─────────────────────────────
// SQLite تخزن القاعدة في ملف واحد على الجهاز
const db = new sqlite3.Database('./registration.db', (err) => {
    if (err) {
        console.error('❌ خطأ في فتح قاعدة البيانات:', err.message);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    }
});


// ── إنشاء جدول الطلاب إذا لم يكن موجوداً ──────────────────
// هذا الجدول هو الـ Table الأساسي في قاعدة البيانات
db.run(`
  CREATE TABLE IF NOT EXISTS students (
    student_id   TEXT PRIMARY KEY,   -- رقم الطالب (المفتاح الأساسي)
    full_name    TEXT NOT NULL,       -- اسم الطالب الكامل
    major        TEXT NOT NULL,       -- التخصص
    gpa          REAL NOT NULL,       -- المعدل التراكمي
    email        TEXT NOT NULL        -- البريد الإلكتروني
  )
`, (err) => {
    if (err) console.error('❌ خطأ في إنشاء الجدول:', err.message);
    else      console.log('✅ جدول الطلاب جاهز');
});


// ============================================================
//  1️⃣  INSERT - إضافة طالب جديد
//  الـ client يرسل: student_id, full_name, major, gpa, email
//  الـ server يستقبل البيانات ويدخلها في قاعدة البيانات
// ============================================================
app.post('/api/students', (req, res) => {
    const { student_id, full_name, major, gpa, email } = req.body;

    // التحقق من وجود جميع الحقول
    if (!student_id || !full_name || !major || !gpa || !email) {
        return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }

    const sql = `INSERT INTO students (student_id, full_name, major, gpa, email)
               VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [student_id, full_name, major, parseFloat(gpa), email], function (err) {
        if (err) {
            // رقم الطالب موجود مسبقاً (PRIMARY KEY constraint)
            if (err.message.includes('UNIQUE')) {
                return res.status(409).json({ success: false, message: 'رقم الطالب موجود مسبقاً' });
            }
            return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات' });
        }
        res.json({ success: true, message: `✅ تم تسجيل الطالب بنجاح (ID: ${student_id})` });
    });
});


// ============================================================
//  2️⃣  DELETE - حذف طالب
//  الـ client يرسل: student_id فقط
//  الـ server يبحث عن الطالب ويحذفه من قاعدة البيانات
// ============================================================
app.delete('/api/students/:id', (req, res) => {
    const { id } = req.params;

    const sql = `DELETE FROM students WHERE student_id = ?`;

    db.run(sql, [id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات' });
        }
        if (this.changes === 0) {
            // this.changes = عدد الصفوف المتأثرة، إذا كان 0 يعني الطالب غير موجود
            return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
        }
        res.json({ success: true, message: `✅ تم حذف الطالب (${id}) بنجاح` });
    });
});


// ============================================================
//  3️⃣  UPDATE - تعديل بيانات طالب
//  الـ client يرسل: current_id (للبحث) + البيانات الجديدة
//  الـ server يحدّث السجل في قاعدة البيانات
// ============================================================
app.put('/api/students/:id', (req, res) => {
    const { id } = req.params;
    const { new_student_id, full_name, major, gpa, email } = req.body;

    if (!new_student_id || !full_name || !major || !gpa || !email) {
        return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }

    const sql = `UPDATE students
               SET student_id = ?, full_name = ?, major = ?, gpa = ?, email = ?
               WHERE student_id = ?`;

    db.run(sql, [new_student_id, full_name, major, parseFloat(gpa), email, id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
        }
        res.json({ success: true, message: `✅ تم تحديث بيانات الطالب بنجاح` });
    });
});


// ============================================================
//  4️⃣  READ - البحث عن طالب
//  الـ client يرسل: student_id للبحث
//  الـ server يعيد تفاصيل الطالب أو رسالة "غير موجود"
// ============================================================
app.get('/api/students/:id', (req, res) => {
    const { id } = req.params;

    const sql = `SELECT * FROM students WHERE student_id = ?`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات' });
        }
        if (!row) {
            // الطالب غير موجود في قاعدة البيانات
            return res.status(404).json({ success: false, message: 'الطالب غير موجود في النظام' });
        }
        res.json({ success: true, student: row });
    });
});


// ── GET all students (لعرض جميع الطلاب في الجدول) ──────────
app.get('/api/students', (req, res) => {
    db.all(`SELECT * FROM students ORDER BY student_id`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات' });
        res.json({ success: true, students: rows });
    });
});


// ── تشغيل الـ Server ────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على: http://localhost:${PORT}`);
    console.log(`📂 افتح index.html في المتصفح أو http://localhost:${PORT}/index.html`);
});
