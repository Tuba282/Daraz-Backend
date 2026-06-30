const PDFDocument = require('pdfkit');

/**
 * Generate a PDF invoice for an order.
 * Returns a Buffer of the PDF.
 */
const generateInvoicePDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ─── Header ─────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill('#f85606');
    doc
      .fillColor('white')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('DARAZ CLONE', 50, 25);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Multi-Vendor Marketplace', 50, 53);

    doc.fillColor('#333').fontSize(10).font('Helvetica');

    // ─── Invoice Title ───────────────────────────────────
    doc.moveDown(3);
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#f85606')
      .text('INVOICE', { align: 'center' });
    doc.moveDown(0.5);

    // ─── Order Info ──────────────────────────────────────
    const startY = doc.y;
    doc.fillColor('#333').fontSize(10).font('Helvetica');

    doc.text(`Invoice Number: INV-${order.orderNumber}`, 50, startY);
    doc.text(`Order Number: ${order.orderNumber}`, 50, startY + 18);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-PK')}`, 50, startY + 36);
    doc.text(`Payment Method: ${order.paymentMethod.toUpperCase()}`, 50, startY + 54);
    doc.text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 50, startY + 72);

    // ─── Shipping Address ────────────────────────────────
    const addr = order.shippingAddress;
    doc.text('Bill To:', 350, startY, { width: 200, align: 'left' });
    doc.font('Helvetica-Bold').text(addr.fullName, 350, startY + 18);
    doc.font('Helvetica').text(addr.addressLine1, 350, startY + 36);
    if (addr.addressLine2) doc.text(addr.addressLine2, 350, startY + 54);
    doc.text(`${addr.city}, ${addr.state} ${addr.postalCode}`, 350, startY + 72);
    doc.text(addr.country, 350, startY + 90);
    doc.text(`Phone: ${addr.phone}`, 350, startY + 108);

    doc.moveDown(8);

    // ─── Items Table ─────────────────────────────────────
    const tableTop = doc.y + 10;
    const col = { item: 50, qty: 330, price: 390, total: 460 };

    // Table header
    doc.rect(50, tableTop, 510, 22).fill('#f85606');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    doc.text('Item', col.item + 5, tableTop + 6);
    doc.text('Qty', col.qty, tableTop + 6);
    doc.text('Price', col.price, tableTop + 6);
    doc.text('Total', col.total, tableTop + 6);

    // Table rows
    let rowY = tableTop + 22;
    doc.fillColor('#333').font('Helvetica').fontSize(9);

    order.items.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
      doc.rect(50, rowY, 510, 20).fill(bg);
      doc.fillColor('#333');
      doc.text(item.name, col.item + 5, rowY + 5, { width: 270 });
      doc.text(String(item.quantity), col.qty, rowY + 5);
      doc.text(`Rs. ${item.price.toLocaleString()}`, col.price, rowY + 5);
      doc.text(`Rs. ${(item.price * item.quantity).toLocaleString()}`, col.total, rowY + 5);
      rowY += 20;
    });

    // ─── Totals ──────────────────────────────────────────
    rowY += 10;
    doc.moveTo(350, rowY).lineTo(560, rowY).stroke('#ddd');
    rowY += 5;

    const addRow = (label, value, bold = false) => {
      if (bold) doc.font('Helvetica-Bold').fillColor('#f85606');
      else doc.font('Helvetica').fillColor('#666');
      doc.text(label, 350, rowY);
      doc.fillColor('#333').font(bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(value, 460, rowY, { align: 'left' });
      rowY += 18;
    };

    addRow('Subtotal:', `Rs. ${order.subtotal.toLocaleString()}`);
    addRow('Shipping:', `Rs. ${order.shippingCharge.toLocaleString()}`);
    if (order.discountAmount > 0) addRow('Discount:', `-Rs. ${order.discountAmount.toLocaleString()}`);
    if (order.taxAmount > 0) addRow('Tax:', `Rs. ${order.taxAmount.toLocaleString()}`);
    addRow('Total:', `Rs. ${order.totalAmount.toLocaleString()}`, true);

    // ─── Footer ──────────────────────────────────────────
    doc.moveDown(3);
    doc
      .fontSize(9)
      .fillColor('#999')
      .font('Helvetica')
      .text('Thank you for shopping with Daraz Clone!', { align: 'center' })
      .text('For support: support@darazclone.com', { align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePDF };
