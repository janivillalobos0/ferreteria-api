const pool = require('../config/db');

const crearFactura = async (req, res) => {
    const client = await pool.connect();
    try {
        const { numero_factura, cliente_id, usuario_id, items } = req.body;
        // items debe ser un array: [{ producto_id: 1, cantidad: 2 }]

        await client.query('BEGIN'); // Inicia transacción

        let subtotalGeneral = 0;
        const detallesProcesados = [];

        // 1. Verificar stock y calcular precios reales desde la BD
        for (const item of items) {
            const prodRes = await client.query(
                'SELECT precio_venta, stock, nombre FROM productos WHERE id = $1 FOR UPDATE',
                [item.producto_id]
            );

            if (prodRes.rows.length === 0) {
                throw new Error(`Producto ID ${item.producto_id} no existe`);
            }

            const producto = prodRes.rows[0];
            if (producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`);
            }

            const subtotalItem = parseFloat(producto.precio_venta) * item.cantidad;
            subtotalGeneral += subtotalItem;

            detallesProcesados.push({
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                precio_unitario: producto.precio_venta,
                subtotal: subtotalItem
            });
        }

        const impuesto = subtotalGeneral * 0.21; // Ejemplo IVA 21%
        const total = subtotalGeneral + impuesto;

        // 2. Insertar cabecera de la factura
        const facturaRes = await client.query(
            `INSERT INTO facturas (numero_factura, cliente_id, usuario_id, subtotal, impuesto, total)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [numero_factura, cliente_id, usuario_id, subtotalGeneral, impuesto, total]
        );
        const facturaCreada = facturaRes.rows[0];

        // 3. Insertar detalles y descontar stock
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

        await client.query('COMMIT'); // Confirma todos los cambios
        res.status(201).json({ mensaje: 'Factura emitida con éxito', factura: facturaCreada });

    } catch (error) {
        await client.query('ROLLBACK'); // Si hay error, no descuenta stock ni crea factura a medias
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

const obtenerFacturas = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM facturas ORDER BY fecha DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { crearFactura, obtenerFacturas };