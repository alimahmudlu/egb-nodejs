// const {Pool} = require("pg");

import {Pool} from "pg";

const db = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

export default db;