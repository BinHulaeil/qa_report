const express = require('express');
const routes = require('./routes');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
res.sendFile(__dirname + '/index.html');})

app.use(express.json());
app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

