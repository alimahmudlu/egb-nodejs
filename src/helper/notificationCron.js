import db from "./db.js";
import cron from "node-cron";

function calculateDaysLeft(expiryDate) {
    if (!expiryDate) return null;

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

async function checkDocuments() {
    const fileTypes= [
        {
            key: 'passport',
            label: 'Passport',
            label_ru: 'Паспорт',
            label_uz: 'Pasport',
            flow: ['patent', 'bkc', 'russian'],
            dateRequired: true
        },
        {
            key: 'notarized_translation',
            label: 'Translated Passport',
            label_ru: 'Перевод паспорта',
            label_uz: 'Tarjima qilingan passport',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'migration_card',
            label: 'Migration Card',
            label_ru: 'Миграционная карта',
            label_uz: 'Migratsiya kartasi',
            flow: ['patent', 'bkc'],
            dateRequired: true
        },
        {
            key: 'registration_card',
            label: 'Registration Card',
            label_ru: 'Документ о регистрации',
            label_uz: 'Ro’yxatga olish hujjati',
            flow: ['patent', 'bkc'],
            dateRequired: true
        },
        {
            key: 'first_registration_card',
            label: 'First Registration Card',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'id_card',
            label: 'ID card',
            label_ru: 'Удостоверение личности',
            label_uz: 'ID karta',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'russian_diploma_file',
            label: 'Russian diploma',
            label_ru: 'Российский диплом',
            label_uz: 'Rus tili diplomi',
            flow: ['patent'],
            dateRequired: true
        },
        {
            key: 'language_certificate',
            label: 'Language Certificate',
            label_ru: 'Сертификат о знании языка',
            label_uz: 'Til sertifikati',
            flow: ['patent'],
            dateRequired: true
        },
        {
            key: 'contract',
            label: 'Contract',
            label_ru: 'Трудовой договор',
            label_uz: 'Mehnat shartnomasi',
            flow: ['patent', 'bkc', 'russian'],
            dateRequired: false
        },
        {
            key: 'payment_receipt',
            label: 'Payment receipt',
            label_ru: 'Квитанция об оплате',
            label_uz: 'To’lov kvitansiyasi',
            flow: ['patent'],
            dateRequired: true
        },
        {
            key: 'visa',
            label: 'Visa',
            label_ru: 'Виза',
            label_uz: 'Viza',
            flow: ['bkc'],
            dateRequired: true
        },
        {
            key: 'work_authorization',
            label: 'Work authorization',
            label_ru: 'Разрешение на работу',
            label_uz: 'Mehnatga ruxsatnoma',
            dateRequired: false
        },
        {
            key: 'health_insurance',
            label: 'Health insurance',
            label_ru: 'Медицинская страховка',
            label_uz: 'Sog’liqni sug’urtasi',
            flow: ['patent', 'bkc'],
            dateRequired: true
        },
        {
            key: 'medical_certification',
            label: 'Medical certification',
            label_ru: 'Медицинская справка',
            label_uz: 'Tibbiy ma’lumotnoma',
            flow: ['patent', 'bkc', 'russian'],
            dateRequired: true
        },
        {
            key: 'photo',
            label: 'Photo',
            label_ru: 'Фото',
            label_uz: 'Rasm',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'fingerprint_certification',
            label: 'Fingerprint certification',
            label_ru: 'Дактилоскопия',
            label_uz: 'Barmoq izi sertifikati',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'patent',
            label: 'Patent',
            label_ru: 'Патент',
            label_uz: 'Patent',
            flow: ['patent'],
            dateRequired: true
        },
        {
            key: 'id_card',
            label: 'ID card',
            label_ru: 'Удостоверение личности',
            label_uz: 'ID karta',
            flow: ['patent', 'bkc'],
            dateRequired: false
        },
        {
            key: 'bkc_payment_receipt',
            label: 'BKC payment receipt',
            label_ru: 'Квитанция об оплате БКЦ',
            label_uz: 'BKC to‘lovi kvitansiyasi',
            flow: ['bkc'],
            dateRequired: false
        },
        {
            key: 'immigration_committee_notification',
            label: 'immigration_committee_notification',
            label_ru: 'Уведомление в иммиграционный комитет',
            label_uz: 'Immigratsiya qo‘mitasiga xabarnoma',
            flow: ['bkc'],
            dateRequired: false
        },
        {
            key: 'invitation_visa',
            label: 'Invitation visa',
            label_ru: 'Пригласительная виза',
            label_uz: 'Tashrif vizasi',
            flow: ['bkc'],
            dateRequired: false
        },
        {
            key: 'bkc',
            label: 'BKC',
            label_ru: 'БКЦ',
            label_uz: 'BKC',
            flow: ['bkc'],
            dateRequired: true
        },
        {
            key: 'military_id_card',
            label: 'Military ID card',
            label_ru: 'Военный билет',
            label_uz: 'Harbiy guvohnoma',
            flow: ['russian'],
            dateRequired: true
        },
        {
            key: 'diploma',
            label: 'Diploma',
            label_ru: 'Диплом',
            label_uz: 'Diplom',
            flow: ['russian'],
            dateRequired: false
        },
        {
            key: 'entry_form_document',
            label: 'Entry Form document',
            flow: ['patent', 'bkc', 'russian'],
            dateRequired: false
        }
    ]
    const client = await db.connect();
    try {
        const { rows: documents } = await client.query(`
      SELECT 
        au.id AS upload_id,
        au.date_of_expiry,
        u.id AS user_id,
        au.type AS type
      FROM application_uploads au
      JOIN applications a ON a.id = au.application_id
      JOIN employees u ON u.application_id = a.id
      WHERE au.date_of_expiry IS NOT NULL
    `);

        for (const doc of documents) {
            const daysLeft = calculateDaysLeft(doc.date_of_expiry);
            const fileName = fileTypes.find(el => el.type === doc.type)?.label;

            if (daysLeft !== null && daysLeft <= 0) {
                const exists = await client.query(
                    `SELECT 1 FROM notifications 
           WHERE type = 'document' 
             AND url = $1 
             AND user_id = $2`,
                    [`/documents/${doc.upload_id}`, doc.user_id]
                );

                if (exists.rowCount === 0) {
                    await client.query(
                        `INSERT INTO notifications (title, description, type, url, user_id, create_at, update_at, read))
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            "The document has expired.",
                            `This document (${fileName}) is no longer valid.`,
                            "document",
                            `/documents/${doc.upload_id}`,
                            doc.user_id,
                            new Date(),
                            new Date(),
                            0
                        ]
                    );
                }
            }

            else if (daysLeft !== null && daysLeft <= 30) {
                const exists = await client.query(
                    `SELECT id FROM notifications 
           WHERE type = 'document' 
             AND url = $1 
             AND user_id = $2`,
                    [`/documents/${doc.upload_id}`, doc.user_id]
                );

                if (exists.rowCount === 0) {
                    // insert
                    await client.query(
                        `INSERT INTO notifications (title, description, type, url, user_id, create_at, update_at, read)))
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            "The document is nearing expiration.",
                            `This document (${fileName}) has ${daysLeft} days left to expire.`,
                            "document",
                            `/documents/${doc.upload_id}`,
                            doc.user_id,
                            new Date(),
                            new Date(),
                            0
                        ]
                    );
                } else {
                    await client.query(
                        `UPDATE notifications 
             SET description = $1, update_at = NOW(), read = 0
             WHERE id = $2`,
                        [
                            `This document (${fileName}) has ${daysLeft} days left to expire.`,
                            exists.rows[0].id,
                        ]
                    );
                }
            }
        }
    } catch (err) {
        console.error("❌ Xəta baş verdi:", err);
    } finally {
        client.release();
    }
}

// 🔹 Hər gün saat 03:15-də işə düşəcək
cron.schedule(
    "15 00 * * *",
    () => {
        checkDocuments();
    }
);

console.log("⏳ Notifications cron işə salındı...");
