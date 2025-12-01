import db from "./db.js";

const chunkArray = (array, size) => {
    const chunked = [];
    let index = 0;
    while (index < array.length) {
        chunked.push(array.slice(index, size + index));
        index += size;
    }
    return chunked;
};

export default async function sendPushNotification(userId, title, body, data = {}) {
    // const { rows } = await db.query(`
    //     SELECT token FROM notification_tokens
    //     WHERE user_id = $1 AND status = 1
    // `, [userId]);
    //
    // if (rows.length === 0) {
    //     return;
    // }

    // rows.map(async row => {
    //     const message = {
    //                 to: row?.token,
    //                 sound: 'default',
    //                 title,
    //                 body,
    //                 subtitle: "Yeni Məlumat",
    //                 priority: 'high',
    //                 channelId: 'default',
    //                 data: {
    //                     event: 'new_data',
    //                     timestamp: Date.now(),
    //                     ...data
    //                 },
    //     };
    //
    //     const res = await fetch("https://exp.host/--/api/v2/push/send", {
    //         method: "POST",
    //         headers: {
    //             Accept: "application/json",
    //             "Accept-encoding": "gzip, deflate",
    //             "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify(message),
    //     });
    //
    //     const result = await res.json();
    //
    //     if (result?.data?.status === 'error') {
    //         const {rows: deletedRow} = db.query(`UPDATE notification_tokens SET status = 0 WHERE token = $1`, [row?.token])
    //     }
    // })
}