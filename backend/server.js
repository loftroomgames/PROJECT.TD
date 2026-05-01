const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();


app.use(cors());
app.use(express.json({ limit: '2mb' }));


// date pseudo pana legam de ESP
let cameraStatus = {
    isConnected: true,
    lastImage: "",
    angle: 90
};


// calea catre pagina web
app.use(express.static(path.join(__dirname, '../frontend')));



app.get('/api/status', (req, res) => {
    res.json(cameraStatus);
});

app.post('/api/upload', (req, res) => {
    const { image } = req.body;
    cameraStatus.lastImage = image;
    res.json({ success: true, target_angle: cameraStatus.angle });
});


// trimite pagina principală către toți
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/index.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serverul rulează pe portul ${PORT}`));