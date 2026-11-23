const { Router } = require('express');
const ctrl = require('../controllers/categorias.controller');

const router = Router();

router.get('/', ctrl.listarCategorias);
router.get('/:id', ctrl.obtenerCategoria);
router.post('/', ctrl.crearCategoria);
router.put('/:id', ctrl.actualizarCategoria);
router.delete('/:id', ctrl.eliminarCategoria);

module.exports = router;