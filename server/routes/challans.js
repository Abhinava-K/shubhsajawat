const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { models } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

function buildChallanQuery(id) {
  if (!id) return { id: null };
  const trimmed = id.trim();
  if (mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
    return { $or: [{ id: trimmed }, { _id: trimmed }] };
  }
  return { id: trimmed };
}

// GET /api/challans - All authenticated users (Admin, Loader, Viewer) can view
router.get('/', async (req, res) => {
  try {
    const challans = await models.Challan.find().sort({ createdAt: -1 });
    res.json({ challans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challans from database.' });
  }
});

// GET /api/challans/:id - Get single challan
router.get('/:id', async (req, res) => {
  try {
    const challan = await models.Challan.findOne(buildChallanQuery(req.params.id));
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found in database.' });
    }
    res.json({ challan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challan from database.' });
  }
});

// POST /api/challans - Create Digital Challan (ONLY Loader and Admin)
router.post('/', requireRole(['admin', 'loader']), async (req, res) => {
  try {
    const { clientName, venue, vehicleNumber, dispatchDate, dueDate, items, notes } = req.body;

    if (!clientName || !venue) {
      return res.status(400).json({ error: 'Client Name and Venue are required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one material line item is required.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const challanDate = dispatchDate || todayStr;
    const returnDueDate = dueDate || challanDate;

    const validItems = items.filter(it => it.itemName && it.itemName.trim() !== '').map((it, idx) => ({
      srNo: idx + 1,
      itemName: it.itemName.trim(),
      size: (it.size || '').trim(),
      quantity: Math.max(1, parseInt(it.quantity) || 1),
      unit: (it.unit || '').trim(),
      remark: (it.remark || '').trim(),
      returnedQty: 0,
      lossOrDamageQty: 0
    }));

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Please specify valid material items.' });
    }

    const totalItemsCount = validItems.reduce((acc, it) => acc + it.quantity, 0);
    const challanId = "SS-CH-" + challanDate.replace(/-/g, "") + "-" + Date.now().toString().slice(-4);

    const newChallan = {
      id: challanId,
      clientName: clientName.trim(),
      venue: venue.trim(),
      vehicleNumber: (vehicleNumber || '').trim(),
      dispatchDate: challanDate,
      dueDate: returnDueDate,
      dispatcherName: req.user.name,
      receiverName: "Site Representative",
      status: "At Site",
      totalItemsCount,
      items: validItems,
      notes: (notes || '').trim()
    };

    const historyRecord = {
      id: "h-" + Date.now().toString().slice(-6),
      date: challanDate,
      itemName: `${validItems.length} items (${challanId})`,
      from: "Warehouse",
      to: `${clientName.trim()} (${venue.trim()})`,
      qty: totalItemsCount,
      type: "Dispatch",
      operator: req.user.name,
      refId: challanId
    };

    await models.Challan.create(newChallan);
    await models.MovementHistory.create(historyRecord);

    res.status(201).json({
      message: 'Digital Challan created successfully.',
      challan: newChallan
    });
  } catch (err) {
    console.error('Create challan error:', err);
    res.status(500).json({ error: 'Server error while creating challan in database.' });
  }
});

// POST /api/challans/:id/returns - Receive Return & Shortage (ONLY Loader and Admin)
router.post('/:id/returns', requireRole(['admin', 'loader']), async (req, res) => {
  try {
    const { returns, notes } = req.body;
    const challan = await models.Challan.findOne(buildChallanQuery(req.params.id));

    if (!challan) {
      return res.status(404).json({ error: 'Challan not found in database.' });
    }

    if (!returns || !Array.isArray(returns) || returns.length === 0) {
      return res.status(400).json({ error: 'Return details required.' });
    }

    let totalReturned = 0;
    let totalDamaged = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    returns.forEach(ret => {
      const it = challan.items.find(x => x.srNo === Number(ret.srNo));
      if (it) {
        const retQty = Math.max(0, parseInt(ret.returnedQty) || 0);
        const dmgQty = Math.max(0, parseInt(ret.damageQty) || 0);

        it.returnedQty = (it.returnedQty || 0) + retQty;
        it.lossOrDamageQty = (it.lossOrDamageQty || 0) + dmgQty;

        totalReturned += retQty;
        totalDamaged += dmgQty;
      }
    });

    if (totalReturned === 0 && totalDamaged === 0) {
      return res.status(400).json({ error: 'No returned or damaged quantities entered.' });
    }

    // Check if fully returned
    const remainingOut = challan.items.reduce((acc, it) => {
      const out = it.quantity - (it.returnedQty || 0) - (it.lossOrDamageQty || 0);
      return acc + Math.max(0, out);
    }, 0);

    if (remainingOut === 0) {
      challan.status = "Fully Returned";
    } else {
      challan.status = "Partially Returned";
    }

    const histRecords = [];
    const baseTimestamp = Date.now();
    if (totalReturned > 0) {
      histRecords.push({
        id: "h-" + baseTimestamp.toString().slice(-6),
        date: todayStr,
        itemName: `Material returned from ${challan.clientName}`,
        from: challan.venue,
        to: "Warehouse",
        qty: totalReturned,
        type: "Return",
        operator: req.user.name,
        refId: challan.id
      });
    }

    if (totalDamaged > 0) {
      histRecords.push({
        id: "h-" + (baseTimestamp + 1).toString().slice(-6),
        date: todayStr,
        itemName: `Damaged / Missing items from ${challan.clientName}`,
        from: challan.venue,
        to: "Scrap / Repair",
        qty: totalDamaged,
        type: "Damage",
        operator: req.user.name,
        refId: challan.id
      });
    }

    challan.markModified('items');
    await challan.save();
    if (histRecords.length > 0) {
      await models.MovementHistory.insertMany(histRecords);
    }

    res.json({
      message: `Return recorded successfully. ${totalReturned} units received into warehouse.`,
      challan
    });
  } catch (err) {
    console.error('Process return error:', err);
    res.status(500).json({ error: 'Server error while processing return in database.' });
  }
});

// DELETE /api/challans/:id - Admin only
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const result = await models.Challan.findOneAndDelete(buildChallanQuery(req.params.id));
    if (!result) return res.status(404).json({ error: 'Challan not found in database.' });
    return res.json({ message: `Challan ${result.id} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete challan from database.' });
  }
});

module.exports = router;
