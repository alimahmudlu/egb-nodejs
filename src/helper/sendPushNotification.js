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
    // 1. Aktiv Tokenləri Bazadan Götür
    const { rows } = await db.query(`
        SELECT token FROM notification_tokens
        WHERE user_id = $1 AND status = 1
    `, [userId]);

    console.log(rows, userId, 'rows', `
        SELECT token FROM notification_tokens
        WHERE user_id = $1 AND status = 1
    `)

    if (rows.length === 0) {
        console.log(`[PushService] İstifadəçi ${userId} üçün aktiv token tapılmadı.`);
        return;
    }

    const tokens = rows.map(row => row.token);
    const tokenBatches = chunkArray(tokens, 100);

    const failedTokens = [];

    for (const batch of tokenBatches) {
        const messages = batch.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            subtitle: "Yeni Məlumat",
            priority: 'high',
            channelId: 'default',
            data: {
                event: 'new_data',
                timestamp: Date.now(),
                ...data
            },
        }));

        try {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(messages),
            });

            const result = await res.json();

            if (result?.data) {
                for (const ticket of result.data) {
                    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                        const token = messages.find(m => m.id === ticket.id)?.to || null;
                        const index = result.data.indexOf(ticket);
                        if (index !== -1 && batch[index]) {
                            failedTokens.push(batch[index]);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("[PushService] Expo API ilə əlaqə xətası:", error);
        }
    }

    if (failedTokens.length > 0) {
        const tokenList = failedTokens.join("','");

        await db.query(`
            UPDATE notification_tokens 
            SET status = 0 
            WHERE token IN ('${tokenList}')
        `);
        console.log(`[PushService] ${failedTokens.length} qeyri-aktiv token deaktiv edildi.`);
    }
}