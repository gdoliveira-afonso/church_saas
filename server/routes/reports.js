const express = require('express');
const router = express.Router();
const { generatePDF } = require('../services/pdfGenerator');
const prisma = require('../lib/prisma');

router.post('/generate', async (req, res) => {
    try {
        const { type, payload } = req.body;

        if (!type || !payload) {
            return res.status(400).json({ error: 'Tipo e payload são requiridos' });
        }

        // Fetch user context if needed, but we rely mostly on the rich payload sent by frontend
        // which already computed complex cell hierarchies and filters.
        console.log(`Generating ${type} report via Puppeteer...`);

        const pdfBuffer = await generatePDF(type, payload);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="report_${type}_${Date.now()}.pdf"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Erro gerando relatório PDF' });
    }
});

module.exports = router;
