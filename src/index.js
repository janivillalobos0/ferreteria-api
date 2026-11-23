const express = require('express');
const cors = require('cors');
require('dotenv').config();

const categoriasRoutes = require('./routes/categorias.routes');
const productosRoutes = require('./routes/productos.routes');
const clientesRoutes = require('./routes/clientes.routes');
const facturasRoutes = require('./routes/facturas.routes');
const { errorHandler, AppError } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/facturas', facturasRoutes);

// Ruta no encontrada (404)
app.use((req, res, next) => {
  next(new AppError('Ruta no encontrada', 404, 'NOT_FOUND'));
});

// Middleware global de errores (siempre al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});