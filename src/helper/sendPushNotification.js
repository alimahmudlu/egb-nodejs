import db from "./db.js";


export default async function sendPushNotification(user_id, title, body) {
    const {rows} = await db.query(`SELECT * FROM notification_tokens WHERE user_id = $1 AND status = 1`, [user_id])


    rows.map(async row => {
        const message = {
            to: row?.token,
            sound: 'default',
            title,
            body,
            data: { customData: 'baz' },
        };

        const res = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });

        const result = await res.json();

        if (result?.data?.status === 'error') {
            const {rows: deletedRow} = db.query(`UPDATE notification_tokens SET status = 0 WHERE token = $1`, [row?.token])
        }
    })




}