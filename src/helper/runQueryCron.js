import db from "./db.js";
import cron from "node-cron";

async function checkDocuments() {
    const client = await db.connect();
    try {
        const { rows } = await client.query(`
            WITH DuplicateFinder AS (
                SELECT
                    ID, -- Unikal ID sütununuz
                    ROW_NUMBER() OVER(
            PARTITION BY
                employee_id,
--                 DATE(review_time),
                type,
                activity_id  -- <<< Əlavə olunan sütun
            ORDER BY
                ID -- ID-si ən kiçik olanı (ilk qeydi) saxla (rn=1)
            ) as rn
                FROM
                    employee_activities
                WHERE
                    status = 2 AND type = 4
            )
            DELETE FROM
                employee_activities
            WHERE
                ID IN (
                    SELECT
                        ID
                    FROM
                        DuplicateFinder
                    WHERE
                        rn > 1 -- Sıra nömrəsi 1-dən böyük olanları (təkrar olanları) sil
                );
    `);
        const { rows:rows2 } = await client.query(`
            WITH DuplicateFinder AS (
                WITH DuplicateFinder AS (
                    SELECT
                        ID, -- Unikal ID sütununuz
                        ROW_NUMBER() OVER(
            PARTITION BY
                employee_id,
--                 DATE(review_time),
                type,
                activity_id  -- <<< Əlavə olunan sütun
            ORDER BY
                ID -- ID-si ən kiçik olanı (ilk qeydi) saxla (rn=1)
            ) as rn
                    FROM
                        employee_activities
                    WHERE
                        status = 2 AND type = 2
                )
            DELETE FROM
                employee_activities
            WHERE
                ID IN (
                    SELECT
                        ID
                    FROM
                        DuplicateFinder
                    WHERE
                        rn > 1 -- Sıra nömrəsi 1-dən böyük olanları (təkrar olanları) sil
                );
    `);
    } catch (err) {
        console.error("Xəta baş verdi:", err);
    } finally {
        client.release();
    }
}

cron.schedule(
    "0 * * * *",
    () => {
        checkDocuments();
    }
);
