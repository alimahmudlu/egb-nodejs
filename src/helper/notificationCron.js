import db from "./db.js";
import cron from "node-cron";

// 🔹 Gün fərqini hesablamaq üçün util
function calculateDaysLeft(expiryDate) {
    if (!expiryDate) return null;

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// 🔹 Əsas funksiya
async function checkDocuments() {
    // const client = await db.connect();
    try {
        console.log("🔍 Sənədlər yoxlanılır...");

        // Bütün sənədləri götür (yalnız date_of_expiry dolu olanları)
        const { rows: documents } = await db.query(`
      SELECT 
        au.id AS upload_id,
        au.date_of_expiry,
        u.id AS user_id
      FROM application_uploads au
      JOIN applications a ON a.id = au.application_id
      JOIN employees u ON u.application_id = a.id
      WHERE au.date_of_expiry IS NOT NULL
    `);

        for (const doc of documents) {
            const daysLeft = calculateDaysLeft(doc.date_of_expiry);

            // 👉 Expired sənədlər
            if (daysLeft !== null && daysLeft <= 0) {
                const exists = await db.query(
                    `SELECT 1 FROM notifications 
           WHERE type = 'document' 
             AND url = $1 
             AND user_id = $2`,
                    [`/documents/${doc.upload_id}`, doc.user_id]
                );

                if (exists.rowCount === 0) {
                    await db.query(
                        `INSERT INTO notifications (title, description, type, url, user_id)
             VALUES ($1, $2, $3, $4, $5)`,
                        [
                            "Sənədin vaxtı bitib",
                            "Bu sənəd artıq etibarsızdır",
                            "document",
                            `/documents/${doc.upload_id}`,
                            doc.user_id,
                        ]
                    );
                    console.log(`➕ Expired sənəd üçün bildiriş əlavə edildi: ${doc.upload_id}`);
                }
            }

            // 👉 Vaxtı yaxınlaşan sənədlər (≤30 gün)
            else if (daysLeft !== null && daysLeft <= 30) {
                const exists = await db.query(
                    `SELECT id FROM notifications 
           WHERE type = 'document' 
             AND url = $1 
             AND user_id = $2`,
                    [`/documents/${doc.upload_id}`, doc.user_id]
                );

                if (exists.rowCount === 0) {
                    // insert
                    await db.query(
                        `INSERT INTO notifications (title, description, type, url, user_id)
             VALUES ($1, $2, $3, $4, $5)`,
                        [
                            "Sənədin vaxtı yaxınlaşır",
                            `Bu sənədin vaxtının bitməsinə ${daysLeft} gün qalıb`,
                            "document",
                            `/documents/${doc.upload_id}`,
                            doc.user_id,
                        ]
                    );
                    console.log(`➕ Yaxınlaşan sənəd üçün bildiriş əlavə edildi: ${doc.upload_id}`);
                } else {
                    // update
                    await db.query(
                        `UPDATE notifications 
             SET description = $1, updated_at = NOW()
             WHERE id = $2`,
                        [
                            `Bu sənədin vaxtının bitməsinə ${daysLeft} gün qalıb`,
                            exists.rows[0].id,
                        ]
                    );
                    console.log(`♻️ Bildiriş yeniləndi: ${doc.upload_id} (${daysLeft} gün)`);
                }
            }
        }

        console.log("✅ Bildirişlərin yoxlanması tamamlandı");
    } catch (err) {
        console.error("❌ Xəta baş verdi:", err);
    } finally {
        db.release();
    }
}

// 🔹 Hər gün saat 03:15-də işə düşəcək
cron.schedule(
    "50 23 * * *",
    () => {
        checkDocuments();
    }
);

console.log("⏳ Notifications cron işə salındı...");
