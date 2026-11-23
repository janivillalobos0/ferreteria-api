const pool = require('../config/db');
const { AppError } = require('../middlewares/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/queryHelpers');

function validarProducto(body, isUpdate = false) {
  const errors = [];
  const { nombre, precio, stock, categoria_id, codigo_barras } = body;

  if (!isUpdate || nombre !== undefined) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      errors.push('El nombre del producto es obligatorio (mínimo 2 caracteres)');
    }
  }
  if (!isUpdate || precio !== undefined) {
    if (precio === undefined || Number.isNaN(Number(precio)) || Number(precio) <= 0) {
      errors.push('El precio debe ser un número mayor que 0');
    }
  }
  if (!isUpdate || stock !== undefined) {
    if (stock === undefined || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      errors.push('El stock debe ser un entero mayor o igual a 0');
    }
  }
  if (categoria_id !== undefined && categoria_id !== null && !Number.isInteger(Number(categoria_id))) {
    errors.push('categoria_id debe ser un entero válido');
  }
  if (codigo_barras !== undefined && codigo_barras !== null && String(codigo_barras).trim() === '') {
    errors.push('El código no puede estar vacío');
  }

  if (errors.length > 0) {
    throw new AppError('Datos de producto no válidos', 400, 'VALIDATION_ERROR', errors);
  }
}

async function listarProductos(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, categoria_id, stock_bajo } = req.query;

    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(p.nombre ILIKE $${params.length} OR COALESCE(p.codigo_barras, '') ILIKE $${params.length})`);
    }
    if (categoria_id) {
      params.push(Number(categoria_id));
      conditions.push(`p.categoria_id = $${params.length}`);
    }
    if (stock_bajo === 'true') {
      conditions.push(`p.stock <= 5`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM productos p ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      ok: true,
      data: dataRes.rows,
      pagination: buildPaginationMeta(total, page, limit)
    });
  } catch (err) {
    next(err);
  }
}

async function obtenerProducto(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de producto no válido', 400, 'VALIDATION_ERROR');
    }

    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function crearProducto(req, res, next) {
  try {
    validarProducto(req.body, false);
    const { codigo_barras = null, nombre, descripcion = null, precio, stock, categoria_id = null } = req.body;

    const result = await pool.query(
      `INSERT INTO productos (codigo_barras, nombre, descripcion, precio, stock, categoria_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [codigo_barras, nombre.trim(), descripcion, Number(precio), Number(stock), categoria_id]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function actualizarProducto(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de producto no válido', 400, 'VALIDATION_ERROR');
    }

    validarProducto(req.body, true);

    const actualRes = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (actualRes.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
    }
    const actual = actualRes.rows[0];

    const codigo_barras = req.body.codigo_barras !== undefined ? req.body.codigo_barras : actual.codigo_barras;
    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre;
    const descripcion = req.body.descripcion !== undefined ? req.body.descripcion : actual.descripcion;
    const precio = req.body.precio !== undefined ? Number(req.body.precio) : Number(actual.precio);
    const stock = req.body.stock !== undefined ? Number(req.body.stock) : Number(actual.stock);
    const categoria_id = req.body.categoria_id !== undefined ? req.body.categoria_id : actual.categoria_id;

    const updated = await pool.query(
      `UPDATE productos
       SET codigo_barras = $1, nombre = $2, descripcion = $3, precio = $4, stock = $5, categoria_id = $6
       WHERE id = $7
       RETURNING *`,
      [codigo_barras, nombre, descripcion, precio, stock, categoria_id, id]
    );

    res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function eliminarProducto(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de producto no válido', 400, 'VALIDATION_ERROR');
    }

    const deleted = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: { id: deleted.rows[0].id, deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto
};