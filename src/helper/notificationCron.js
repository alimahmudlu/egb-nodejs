import cron from 'node-cron'
import db from '../helper/db.js'

async function checkDocuments() {
    const client = await db.connect();
    try {
        console.log("Sənədlər yoxlanılır...");

        await client.query(`
      INSERT INTO notifications (title, description, type, url, user_id)
      SELECT 
        'Sənədin vaxtı bitib',
        'Bu sənəd artıq etibarsızdır',
        'document',
        CONCAT('/documents/', au.id),
        u.id
      FROM application_uploads au
      JOIN applications a ON a.id = au.application_id
      JOIN employees u ON u.application_id = a.id
      WHERE au.date_of_expiry < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'document'
            AND n.url = CONCAT('/documents/', au.id)
            AND n.user_id = u.id
        );
    `);

        // 2. Vaxtı yaxınlaşan sənədlər üçün insert
        await client.query(`
      INSERT INTO notifications (title, description, type, url, user_id)
      SELECT 
        'Sənədin vaxtı yaxınlaşır',
        CONCAT('Bu sənədin vaxtının bitməsinə ', EXTRACT(DAY FROM (au.date_of_expiry - NOW())), ' gün qalıb'),
        'document',
        CONCAT('/documents/', au.id),
        u.id
      FROM application_uploads au
      JOIN applications a ON a.id = au.application_id
      JOIN employees u ON u.application_id = a.id
      WHERE au.date_of_expiry > NOW()
        AND au.date_of_expiry <= NOW() + interval '30 day'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'document'
            AND n.url = CONCAT('/documents/', au.id)
            AND n.user_id = u.id
        );
    `);

        // 3. Vaxtı yaxınlaşan sənədlərin mövcud bildirişlərini update et
        await client.query(`
      UPDATE notifications n
      SET description = CONCAT('Bu sənədin vaxtının bitməsinə ', 
                               EXTRACT(DAY FROM (au.date_of_expiry - NOW())), 
                               ' gün qalıb'),
          updated_at = NOW()
      FROM application_uploads au
      JOIN applications a ON a.id = au.application_id
      JOIN employees u ON u.application_id = a.id
      WHERE n.type = 'document'
        AND n.url = CONCAT('/documents/', au.id)
        AND n.user_id = u.id
        AND au.date_of_expiry > NOW()
        AND au.date_of_expiry <= NOW() + interval '30 day';
    `);

        console.log("Bildirişlər yeniləndi");
    } catch (err) {
        console.error("Xəta baş verdi:", err);
    } finally {
        client.release();
    }
}

// 🔹 Hər gün saat 00:05-də işə sal
cron.schedule("23 41 * * *", () => {
    checkDocuments();
});
