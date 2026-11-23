const { Router } = require('express');
const ctrl = require('../controllers/clientes.controller');

const router = Router();

router.get('/', ctrl.listarClientes);
router.get('/:id', ctrl.obtenerCliente);
router.post('/', ctrl.crearCliente);
router.put('/:id', ctrl.actualizarCliente);
router.delete('/:id', ctrl.eliminarCliente);

module.exports = router;