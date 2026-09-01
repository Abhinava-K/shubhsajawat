const express = require('express');
const router = express.Router();
const { models } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/inventory - Calculate dynamic stock status from MongoDB
router.get('/', async (req, res) => {
  try {
    const catalogItems = await models.CatalogItem.find();
    const challanList = await models.Challan.find();

    // Compute in-field stock from active challans
    const inFieldMap = {};
    challanList.forEach(c => {
      (c.items || []).forEach(it => {
        const out = it.quantity - (it.returnedQty || 0) - (it.lossOrDamageQty || 0);
        if (out > 0) {
          const key = (it.itemName || '').toLowerCase();
          inFieldMap[key] = (inFieldMap[key] || 0) + out;
        }
      });
    });

    const catalogWithLiveStats = catalogItems.map(it => {
      const name = it.name || '';
      const totalStock = it.totalStock || 0;
      const inField = inFieldMap[name.toLowerCase()] || 0;
      const available = Math.max(0, totalStock - inField);
      return {
        id: it.id || (it._id ? it._id.toString() : ''),
        name,
        category: it.category || 'General',
        sizes: it.sizes || ['Standard'],
        totalStock,
        inField,
        available
      };
    });

    res.json({ catalog: catalogWithLiveStats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catalog from database.' });
  }
});

// POST /api/inventory - Add new material to catalog (Admin only)
router.post('/', requireRole(['admin']), async (req, res) => {
  try {
    const { name, category, totalStock, sizes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Material name is required.' });
    }

    const id = "CAT-" + Date.now().toString().slice(-4);
    const itemData = {
      id,
      name: name.trim(),
      category: (category || 'General').trim(),
      sizes: Array.isArray(sizes) ? sizes : ['Standard'],
      totalStock: Math.max(0, parseInt(totalStock) || 0)
    };

    await models.CatalogItem.create(itemData);

    res.status(201).json({ message: `Material ${itemData.name} added to catalog.`, item: itemData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add catalog item.' });
  }
});

// PATCH /api/inventory/:id - Edit catalog stock (Admin only)
router.patch('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const { name, category, totalStock, sizes } = req.body;

    const item = await models.CatalogItem.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] });
    if (!item) return res.status(404).json({ error: 'Material not found in catalog.' });
    
    if (name) item.name = name.trim();
    if (category) item.category = category.trim();
    if (totalStock !== undefined) item.totalStock = Math.max(0, parseInt(totalStock) || 0);
    if (sizes && Array.isArray(sizes)) item.sizes = sizes;
    await item.save();

    res.json({ message: `Material ${item.name} updated.`, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update catalog item.' });
  }
});

module.exports = router;
