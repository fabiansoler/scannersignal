import express from 'express';
import { saveCalculation } from '../db.js';

const router = express.Router();

/**
 * POST /api/calculator/save
 * Guarda un cálculo de posición en la tabla position_calculations.
 */
router.post('/save', (req, res) => {
  const body = req.body ?? {};

  if (!body.pair || body.entry == null) {
    return res.status(400).json({ error: 'Faltan campos requeridos (pair, entry)' });
  }

  try {
    const id = saveCalculation(body);
    res.json({ id: Number(id), saved: true });
  } catch (err) {
    console.error('[calculator] Error al guardar:', err.message);
    res.status(500).json({ error: err.message, saved: false });
  }
});

export default router;
