const express = require('express');
const router = express.Router();
const { models } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/history - Get movement audit trail directly from MongoDB
router.get('/', async (req, res) => {
  try {
    const history = await models.MovementHistory.find().sort({ createdAt: -1 });
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch movement history from database.' });
  }
});

module.exports = router;
