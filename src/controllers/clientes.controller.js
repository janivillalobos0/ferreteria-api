const pool = require('../config/db');
const { AppError } = require('../middlewares/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/queryHelpers');

function validarCliente(body, isUpdate = false) {
  const errors = [];
  const { nombre, documento, email } = body;

  if (!isUpdate || nombre !== undefined) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      errors.push('El nombre del cliente es obligatorio (mínimo 2 caracteres)');
    }
  }
  if (!isUpdate || documento !== undefined) {
    if (!documento || typeof documento !== 'string' || documento.trim().length < 3) {
      errors.push('El documento es obligatorio');
    }
  }
  if (email !== undefined && email !== null && String(email).trim() !== '') {
    if (!String(email).includes('@')) {
      errors.push('El correo electrónico no tiene un formato válido');
    }
  }

  if (errors.length > 0) {
    throw new AppError('Datos de cliente no válidos', 400, 'VALIDATION_ERROR', errors);
  }
}

async function listarClientes(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search } = req.query;

    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(nombre ILIKE $${params.length} OR COALESCE(documento, '') ILIKE $${params.length} OR COALESCE(email, '') ILIKE $${params.length})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM clientes ${whereClause}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM clientes ${whereClause} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

async function obtenerCliente(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de cliente no válido', 400, 'VALIDATION_ERROR');
    }

    const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function crearCliente(req, res, next) {
  try {
    validarCliente(req.body, false);
    const { nombre, documento, telefono = null, email = null, direccion = null } = req.body;

    const result = await pool.query(
      `INSERT INTO clientes (nombre, documento, telefono, email, direccion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre.trim(), documento.trim(), telefono, email, direccion]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function actualizarCliente(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de cliente no válido', 400, 'VALIDATION_ERROR');
    }

    validarCliente(req.body, true);

    const actualRes = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (actualRes.rows.length === 0) {
      throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
    }
    const actual = actualRes.rows[0];

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : actual.nombre;
    const documento = req.body.documento !== undefined ? req.body.documento.trim() : actual.documento;
    const telefono = req.body.telefono !== undefined ? req.body.telefono : actual.telefono;
    const email = req.body.email !== undefined ? req.body.email : actual.email;
    const direccion = req.body.direccion !== undefined ? req.body.direccion : actual.direccion;

    const updated = await pool.query(
      `UPDATE clientes
       SET nombre = $1, documento = $2, telefono = $3, email = $4, direccion = $5
       WHERE id = $6
       RETURNING *`,
      [nombre, documento, telefono, email, direccion, id]
    );

    res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function eliminarCliente(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de cliente no válido', 400, 'VALIDATION_ERROR');
    }

    const deleted = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
    }

    res.json({ ok: true, data: { id: deleted.rows[0].id, deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};