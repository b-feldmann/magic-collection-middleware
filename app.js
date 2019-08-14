const express = require('express');
const path = require('path');

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

const app = express();
const PORT = 3001;

app.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.send("Yep it's working");
});

app.get('/collection', (req, res) => {
  res.send('Get all cards');
});

MongoClient.connect('link-to-mongodb', (err, database) => {
  // ... start the server
});

module.exports = app;
