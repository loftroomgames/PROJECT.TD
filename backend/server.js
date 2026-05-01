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
    angle: 0
};



app.get('/api/status', (req, res) => {
    res.json(cameraStatus);
});


// calea catre pagina web
app.use(express.static(path.join(__dirname, '../frontend')));


app.use((req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/index.html'));
});


app.post('/api/upload', (req, res) => {
    const { image } = req.body;
    cameraStatus.lastImage = image;
    res.json({ success: true, target_angle: cameraStatus.angle });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serverul rulează pe portul ${PORT}`));