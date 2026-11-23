const pool = require('../config/db');
const { AppError } = require('../middlewares/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/queryHelpers');

function validarCategoria(body, isUpdate = false) {
  const errors = [];
  const { nombre } = body;

  if (!isUpdate || nombre !== undefined) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      errors.push('El nombre de la categoría es obligatorio (mínimo 2 caracteres)');
    }
  }

  if (errors.length > 0) {
    throw new AppError('Datos de categoría no válidos', 400, 'VALIDATION_ERROR', errors);
  }
}

async function listarCategorias(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search } = req.query;

    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(nombre ILIKE $${params.length} OR COALESCE(descripcion, '') ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM categorias ${whereClause}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM categorias ${whereClause} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

async function obtenerCategoria(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de categoría no válido', 400, 'VALIDATION_ERROR');
    }

    const result = await pool.query('SELECT * FROM categorias WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function crearCategoria(req, res, next) {
  try {
    validarCategoria(req.body, false);
    const { nombre, descripcion = null } = req.body;

    const result = await pool.query(
      'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), descripcion]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function actualizarCategoria(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de categoría no válido', 400, 'VALIDATION_ERROR');
    }

    validarCategoria(req.body, true);

    const actualRes = await pool.query('SELECT * FROM categorias WHERE id = $1', [id]);
    if (actualRes.rows.length === 0) {
      throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
    }
    const actual = actualRes.rows[0];

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre;
    const descripcion = req.body.descripcion !== undefined ? req.body.descripcion : actual.descripcion;

    const updated = await pool.query(
      'UPDATE categorias SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
      [nombre, descripcion, id]
    );

    res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function eliminarCategoria(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de categoría no válido', 400, 'VALIDATION_ERROR');
    }

    const deleted = await pool.query('DELETE FROM categorias WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: { id: deleted.rows[0].id, deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
};