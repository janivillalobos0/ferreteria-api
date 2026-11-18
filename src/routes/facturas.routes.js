const { Router } = require('express');
const { crearFactura, obtenerFacturas } = require('../controllers/facturas.controller');

const router = Router();

router.get('/', obtenerFacturas);
router.post('/', crearFactura);

module.exports = router;