const express = require('express');
const router = express.Router();
const { db, isMongoConnected, models } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/history - Get movement audit trail
router.get('/', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const history = await models.MovementHistory.find().sort({ createdAt: -1 });
      return res.json({ history });
    }
    res.json({ history: db.data.history || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch movement history.' });
  }
});

module.exports = router;
