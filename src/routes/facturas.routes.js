const { Router } = require('express');
const {
  obtenerFacturas,
  obtenerFacturaPorId,
  crearFactura,
  eliminarFactura
} = require('../controllers/facturas.controller');

const router = Router();

router.get('/', obtenerFacturas);
router.get('/:id', obtenerFacturaPorId);
router.post('/', crearFactura);
router.delete('/:id', eliminarFactura);

module.exports = router;