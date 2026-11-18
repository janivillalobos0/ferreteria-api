const express = require('express');
const cors = require('cors');
require('dotenv').config();

const facturasRoutes = require('./routes/facturas.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/facturas', facturasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});