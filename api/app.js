const express = require('express');
const routes = require('./routes');

require('dotenv').config()

const app = express();
const PORT = process.env.PORT

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './'});
})

app.use(express.json());
app.use('/api', routes);
app.use( express.static( "public" ) );

app.listen(PORT, () => {
    console.log(`Server running on:${PORT}`);
});

