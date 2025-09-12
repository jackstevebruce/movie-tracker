require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2');

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});