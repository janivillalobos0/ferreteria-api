const pool = require('../config/db');
const { AppError } = require('../middlewares/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/queryHelpers');

const crearFactura = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { numero_factura, cliente_id, usuario_id, items } = req.body;

    if (!numero_factura || !cliente_id || !usuario_id || !Array.isArray(items) || items.length === 0) {
      throw new AppError(
        'numero_factura, cliente_id, usuario_id e items (no vacío) son obligatorios',
        400,
        'VALIDATION_ERROR'
      );
    }

    await client.query('BEGIN');

    let subtotalGeneral = 0;
    const detallesProcesados = [];

    for (const item of items) {
      const prodRes = await client.query(
        'SELECT precio, stock, nombre FROM productos WHERE id = $1 FOR UPDATE',
        [item.producto_id]
      );

      if (prodRes.rows.length === 0) {
        throw new AppError(`Producto ID ${item.producto_id} no existe`, 404, 'NOT_FOUND');
      }

      const producto = prodRes.rows[0];
      const cantidad = Number(item.cantidad);

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new AppError('La cantidad de cada item debe ser un entero mayor que 0', 400, 'VALIDATION_ERROR');
      }

      if (Number(producto.stock) < cantidad) {
        throw new AppError(
          `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      const precioUnitario = parseFloat(producto.precio);
      const subtotalItem = precioUnitario * cantidad;
      subtotalGeneral += subtotalItem;

      detallesProcesados.push({
        producto_id: item.producto_id,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotalItem
      });
    }

    const impuesto = Number((subtotalGeneral * 0.21).toFixed(2));
    const total = Number((subtotalGeneral + impuesto).toFixed(2));

    const facturaRes = await client.query(
      `INSERT INTO facturas (numero_factura, cliente_id, usuario_id, subtotal, impuesto, total)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [numero_factura, cliente_id, usuario_id, subtotalGeneral, impuesto, total]
    );
    const facturaCreada = facturaRes.rows[0];

    for (const det of detallesProcesados) {
      await client.query(
        `INSERT INTO detalle_factura (factura_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [facturaCreada.id, det.producto_id, det.cantidad, det.precio_unitario, det.subtotal]
      );

      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2',
        [det.cantidad, det.producto_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Factura emitida con éxito', factura: facturaCreada });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const obtenerFacturas = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { cliente_id, numero } = req.query;

    const conditions = [];
    const params = [];

    if (cliente_id) {
      params.push(Number(cliente_id));
      conditions.push(`cliente_id = $${params.length}`);
    }
    if (numero && String(numero).trim()) {
      params.push(`%${String(numero).trim()}%`);
      conditions.push(`numero_factura ILIKE $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM facturas ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM facturas ${whereClause} ORDER BY fecha DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      ok: true,
      data: result.rows,
      pagination: buildPaginationMeta(total, page, limit)
    });
  } catch (error) {
    next(error);
  }
};

const obtenerFacturaPorId = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de factura no válido', 400, 'VALIDATION_ERROR');
    }

    const facturaRes = await pool.query('SELECT * FROM facturas WHERE id = $1', [id]);
    if (facturaRes.rows.length === 0) {
      throw new AppError('Factura no encontrada', 404, 'NOT_FOUND');
    }

    const detalleRes = await pool.query(
      'SELECT * FROM detalle_factura WHERE factura_id = $1',
      [id]
    );

    res.json({
      ok: true,
      data: {
        ...facturaRes.rows[0],
        items: detalleRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

const eliminarFactura = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de factura no válido', 400, 'VALIDATION_ERROR');
    }

    await client.query('BEGIN');

    const detallesRes = await client.query(
      'SELECT producto_id, cantidad FROM detalle_factura WHERE factura_id = $1',
      [id]
    );

    const delRes = await client.query('DELETE FROM facturas WHERE id = $1 RETURNING id', [id]);
    if (delRes.rows.length === 0) {
      throw new AppError('Factura no encontrada', 404, 'NOT_FOUND');
    }

    for (const det of detallesRes.rows) {
      await client.query(
        'UPDATE productos SET stock = stock + $1 WHERE id = $2',
        [det.cantidad, det.producto_id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, data: { id, deleted: true } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = { obtenerFacturas, obtenerFacturaPorId, crearFactura, eliminarFactura };