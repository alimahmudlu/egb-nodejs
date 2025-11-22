import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';

import auth from './routes/auth.js';
import currentUser from './routes/currentUser.js';

import notification from './routes/notification.js';
import notifications from './routes/notifications.js';
import upload from './routes/upload.js';
import position from './routes/position.js';
import myTeam from "./routes/myTeam.js";

import project from './routes/employee/project.js';
import activity from "./routes/employee/activity.js";
import docEmployee from "./routes/employee/doc.js";

import timeKeeperActivity from "./routes/timeKeeper/activity.js";
import timeKeeperEmployee from "./routes/timeKeeper/employee.js";
import timeKeeperHistory from "./routes/timeKeeper/history.js";
import timeKeeperOptions from "./routes/timeKeeper/options.js";
import docTimeKeeper from "./routes/timeKeeper/doc.js";
import manualTimeKeeper from "./routes/timeKeeper/manual.js";
import timeKeeperOverTime from "./routes/timeKeeper/overtime.js";

import chiefActivity from './routes/chief/activity.js';
import chiefProject from './routes/chief/project.js';
import chiefTask from './routes/chief/task.js';
import chiefOptions from './routes/chief/options.js';
import docChief from "./routes/chief/doc.js";
import chiefEmployee from "./routes/chief/employee.js";

import foodAdmin from "./routes/admin/food.js";
import busAdmin from "./routes/admin/bus.js";
import activityAdmin from "./routes/admin/activity.js";



import { init as initSocket } from "./socketManager.js";

import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


const server = http.createServer(app);

app.get("/", (req, res) => {
    res.status(307).redirect("https://egb-panel.entergreenbuildings.com/signin")
});



app.use('/api/auth', auth)
app.use('/api/currentUser', currentUser)

app.use('/api/upload', upload)

app.use('/api/employee/project', project)
app.use('/api/employee/activity', activity)
app.use('/api/employee/doc', docEmployee)

app.use('/api/timekeeper/activity', timeKeeperActivity)
app.use('/api/timekeeper/employee', timeKeeperEmployee)
app.use('/api/timekeeper/history', timeKeeperHistory)
app.use('/api/timekeeper/doc', docTimeKeeper)
app.use('/api/timekeeper/manual', manualTimeKeeper)
app.use('/api/timekeeper/overtime', timeKeeperOverTime)
app.use('/api/timekeeper/options', timeKeeperOptions)

app.use('/api/chief/activity', chiefActivity)
app.use('/api/chief/project', chiefProject)
app.use('/api/chief/task', chiefTask)
app.use('/api/chief/options', chiefOptions)
app.use('/api/chief/doc', docChief)
app.use('/api/chief/employee', chiefEmployee)

app.use('/api/admin/activity', activityAdmin)
app.use('/api/admin/food', foodAdmin)
app.use('/api/admin/bus', busAdmin)

app.use('/api/notification', notification)
app.use('/api/notifications', notifications)
app.use('/api/position', position)
app.use('/api/my_team', myTeam)

initSocket(server);

server.listen(3000, () => {
    console.log("APP IS RUNNING ON PORT 3000");
});
