import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';

import auth from './routes/auth.js';

import notification from './routes/notification.js';
import upload from './routes/upload.js';

import project from './routes/employee/project.js';
import activity from "./routes/employee/activity.js";

import timeKeeperActivity from "./routes/timeKeeper/activity.js";
import timeKeeperEmployee from "./routes/timeKeeper/employee.js";
import timeKeeperHistory from "./routes/timeKeeper/history.js";

import chiefProject from './routes/chief/project.js';
import chiefTask from './routes/chief/task.js';
import chiefOptions from './routes/chief/options.js';
import { init as initSocket } from "./socketManager.js";

import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());


const server = http.createServer(app);

app.get("/", (req, res) => {
    res.send("Backend çalışıyor");
});



app.use('/api/auth', auth)


app.use('/api/employee/project', project)
app.use('/api/employee/activity', activity)

app.use('/api/timekeeper/activity', timeKeeperActivity)
app.use('/api/timekeeper/employee', timeKeeperEmployee)
app.use('/api/timekeeper/history', timeKeeperHistory)

app.use('/api/chief/project', chiefProject)
app.use('/api/chief/task', chiefTask)
app.use('/api/chief/options', chiefOptions)

app.use('/api/notification', notification)
app.use('/api/upload', upload)

initSocket(server);

server.listen(3000, () => {
    console.log("Server 3000 portunda çalışıyor");
});
