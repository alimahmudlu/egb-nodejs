import { Server } from "socket.io";
import checkAuthSocket from "./middleware/checkAuthSocket.js";

const userSocketMap = new Map(); // userId -> socket.id
let io = null;

export function init(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    // const privateNamespace = io.of("/activity");

    // privateNamespace.use((socket, next) => {
    //     const token = socket.handshake.auth?.token;
    //     if (!token) {
    //         return next(new Error("do not find Token"));
    //     }
    //
    //     try {
    //         const payload = checkAuthSocket(token)
    //         socket.userId = payload.id;
    //         next();
    //     } catch (err) {
    //         return next(new Error("Token sehvdir"));
    //     }
    // });
    //
    // privateNamespace.on("connection", (socket) => {
    //     const userId = socket.userId;
    //     console.log(`[${userId}] bağlandı: ${socket.id}`);
    //
    //     userSocketMap.set(userId, socket.id);
    //
    //     socket.on("disconnect", () => {
    //         console.log(`[${userId}] disconnected: ${socket.id}`);
    //         userSocketMap.delete(userId);
    //     });
    // });


    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("do not find Token"));
        }

        try {
            const payload = await checkAuthSocket(token)
            socket.userId = payload?.id;
            next();
        } catch (err) {
            return next(new Error("Token sehvdir"));
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.userId;
        console.log(`[${userId}] bağlandı: ${socket.id}`);

        userSocketMap.set(userId, socket.id);

        socket.on("disconnect", () => {
            console.log(`[${userId}] disconnected: ${socket.id}`);
            userSocketMap.delete(userId);
        });
    });
}

export function getIO() {
    if (!io) throw new Error("Socket.IO don't running");
    return io;
}

export { userSocketMap };
