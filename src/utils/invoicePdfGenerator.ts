import { jsPDF } from 'jspdf';
import { Product, InvoiceMeta, UserRole } from '../types/product';

export interface InvoicePdfOptions {
  products: Product[];
  meta: InvoiceMeta;
  role: UserRole;
  userOrders: Record<string, number>;
  customerName?: string;
  autoDownload?: boolean;
}

export interface InvoicePdfResult {
  success: boolean;
  message?: string;
  error?: string;
  pageCount?: number;
  productCount?: number;
  grandTotal?: number;
  doc?: jsPDF;
}

export interface InvoiceItem {
  _id: string;
  serialNumber: number;
  name: string;
  price: number;
  quantity: number;
  amount: number;
}

/**
 * Generates an accurate, professional multi-page PDF invoice.
 * Strictly guarantees:
 * - Products with orderQuantity <= 0 are excluded
 * - Dynamic row heights based on multiline text wrapping
 * - Strict Y-coordinate tracking (every row increments Y; no overlapping)
 * - Automatic page breaks when space is exceeded, re-rendering table headers
 * - Accurate order totals and item counts
 */
export function generateInvoicePdf({
  products,
  meta,
  role,
  userOrders,
  customerName = 'Customer User',
  autoDownload = true,
}: InvoicePdfOptions): InvoicePdfResult {
  const isAdmin = role === 'admin';

  // 1. Filter products: Exclude items with 0 quantity
  const validItems: InvoiceItem[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const qty = isAdmin 
      ? (p.stock || 0) 
      : (userOrders && userOrders[p._id] !== undefined ? userOrders[p._id] : (p.orderQuantity || 0));

    if (qty > 0) {
      const price = p.price || 0;
      validItems.push({
        _id: p._id,
        serialNumber: validItems.length + 1, // continuous 1-based numbering
        name: p.name || 'Untitled Product',
        price,
        quantity: qty,
        amount: price * qty,
      });
    }
  }

  // 2. Validate non-empty: if all products have 0 quantity, return error
  if (validItems.length === 0) {
    return {
      success: false,
      error: 'No products to invoice',
      message: isAdmin 
        ? 'No products with available stock to generate inventory report.' 
        : 'Please select an order quantity greater than 0 for at least one product before generating an invoice.',
    };
  }

  // 3. Compute accurate totals strictly from valid items
  const totalUnits = validItems.reduce((sum, it) => sum + it.quantity, 0);
  const grandTotal = validItems.reduce((sum, it) => sum + it.amount, 0);

  // Safe currency label for PDF (Unicode Taka symbol isn't in standard WinAnsi font)
  const currencyLabel = meta.currency === '৳' ? 'Tk ' : (meta.currency ? `${meta.currency} ` : 'Tk ');

  // 4. Initialize jsPDF (A4 portrait: 210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 14;
  const marginRight = 14;
  const marginTop = 16;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginLeft - marginRight; // 182 mm

  // Table Column Specifications (sum = 182mm)
  const colIndexX = marginLeft; // 14
  const colIndexWidth = 12;

  const colNameX = colIndexX + colIndexWidth; // 26
  const colNameWidth = 84;

  const colPriceX = colNameX + colNameWidth; // 110
  const colPriceWidth = 26;

  const colQtyX = colPriceX + colPriceWidth; // 136
  const colQtyWidth = 24;

  const colTotalX = colQtyX + colQtyWidth; // 160
  const colTotalWidth = 36;

  let currentY = marginTop;

  // Helper: Draw Main Document Header (Page 1 only)
  const drawPage1Header = () => {
    // Shop Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text((meta.shopName || 'SHONDANI MEDICAL HALL').toUpperCase(), marginLeft, currentY);

    // Document Subtitle
    currentY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    const subtitle = isAdmin 
      ? 'OFFICIAL INVENTORY & STOCK VALUATION REPORT' 
      : 'CUSTOMER ORDER INVOICE / PURCHASE BILL';
    doc.text(subtitle, marginLeft, currentY);

    // Contact / Address
    currentY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    if (meta.address) {
      doc.text(meta.address, marginLeft, currentY);
      currentY += 3.8;
    }
    if (meta.phone) {
      doc.text(`Contact: ${meta.phone}`, marginLeft, currentY);
      currentY += 3.8;
    }

    // Top-Right Metadata Badge Box
    const metaBoxWidth = 58;
    const metaBoxHeight = 16;
    const metaBoxX = pageWidth - marginRight - metaBoxWidth;
    const metaBoxY = marginTop - 2;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${isAdmin ? 'STATEMENT' : 'INVOICE'} #${meta.invoiceNumber || 'SMH-001'}`, 
      metaBoxX + 3, 
      metaBoxY + 5.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date: ${meta.date}`, metaBoxX + 3, metaBoxY + 10);
    doc.text(`Role: ${isAdmin ? 'Administrator' : customerName}`, metaBoxX + 3, metaBoxY + 14);

    // Divider Line
    currentY = Math.max(currentY + 2, metaBoxY + metaBoxHeight + 3);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);
    currentY += 5;

    // Summary Metric Chips
    const cardWidth = (contentWidth - 8) / 3; // 3 cards with 4mm gap
    const cardHeight = 13;
    const cards = [
      {
        label: isAdmin ? 'TOTAL PRODUCTS' : 'ORDERED ITEMS',
        val: `${validItems.length} items`,
      },
      {
        label: isAdmin ? 'WAREHOUSE UNITS' : 'TOTAL UNITS',
        val: `${totalUnits.toLocaleString()} units`,
      },
      {
        label: isAdmin ? 'INVENTORY VALUE' : 'GRAND TOTAL',
        val: `${currencyLabel}${grandTotal.toLocaleString()}`,
      },
    ];

    for (let c = 0; c < 3; c++) {
      const cx = marginLeft + c * (cardWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, currentY, cardWidth, cardHeight, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(cards[c].label, cx + cardWidth / 2, currentY + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cards[c].val, cx + cardWidth / 2, currentY + 10, { align: 'center' });
    }

    currentY += cardHeight + 5;
  };

  // Helper: Draw Table Header
  const tableHeaderHeight = 7.5;
  const drawTableHeader = (isContinuation = false) => {
    if (isContinuation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${isAdmin ? 'INVENTORY STATEMENT' : 'INVOICE'} #${meta.invoiceNumber || 'SMH-001'} (Continued)`, 
        marginLeft, 
        currentY - 2.5
      );
    }

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.rect(marginLeft, currentY, contentWidth, tableHeaderHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59); // slate-800

    // Header cells with vertical centering
    const textY = currentY + 5;
    doc.text('#', colIndexX + colIndexWidth / 2, textY, { align: 'center' });
    doc.text('Product Name', colNameX + 2.5, textY, { align: 'left' });
    doc.text(`Price (${currencyLabel.trim()})`, colPriceX + colPriceWidth - 2.5, textY, { align: 'right' });
    doc.text(isAdmin ? 'Stock' : 'Qty', colQtyX + colQtyWidth / 2, textY, { align: 'center' });
    doc.text(`Item Total (${currencyLabel.trim()})`, colTotalX + colTotalWidth - 2.5, textY, { align: 'right' });

    currentY += tableHeaderHeight;
  };

  // Render Initial Page 1 Header & Table Header
  drawPage1Header();
  drawTableHeader(false);

  // 5. Render Products with Dynamic Row Height and Y-Tracking
  const lineHeight = 4.0;
  const totalRowHeight = 9;
  const signatureBlockHeight = 22;
  const fullSummaryHeight = totalRowHeight + 6 + signatureBlockHeight;

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    const isLastItem = i === validItems.length - 1;

    // Measure name lines in BOLD within allowed column width (minus 5mm horizontal padding)
    // CRITICAL: Set bold font BEFORE splitTextToSize so character widths match bold typography exactly
    const printableNameWidth = colNameWidth - 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const nameLines = doc.splitTextToSize(item.name, printableNameWidth);

    // Compute actual vertical space occupied by this row
    const lineCount = Math.max(1, nameLines.length);
    const rowHeight = Math.max(7, lineCount * lineHeight + 3);

    // Check if current page has enough vertical space
    // On the last item, keep row together with summary block to avoid orphan signature pages
    const threshold = isLastItem ? (pageHeight - marginBottom - fullSummaryHeight) : (pageHeight - marginBottom);
    if (currentY + rowHeight > threshold) {
      // Automatic clean page break
      doc.addPage();
      currentY = marginTop + 4;
      drawTableHeader(true);
    }

    // Zebra row shading
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, currentY, contentWidth, rowHeight, 'F');
    }

    // Outer row borders
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.rect(marginLeft, currentY, contentWidth, rowHeight, 'S');

    // Column Divider Lines
    doc.line(colNameX, currentY, colNameX, currentY + rowHeight);
    doc.line(colPriceX, currentY, colPriceX, currentY + rowHeight);
    doc.line(colQtyX, currentY, colQtyX, currentY + rowHeight);
    doc.line(colTotalX, currentY, colTotalX, currentY + rowHeight);

    // 1. Index #
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(item.serialNumber), colIndexX + colIndexWidth / 2, currentY + 4.8, { align: 'center' });

    // 2. Product Name (multiline text safely wrapped without overlapping adjacent columns)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(nameLines, colNameX + 2.5, currentY + 4.8);

    // 3. Price
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(item.price.toLocaleString(), colPriceX + colPriceWidth - 2.5, currentY + 4.8, { align: 'right' });

    // 4. Quantity
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(item.quantity.toLocaleString(), colQtyX + colQtyWidth / 2, currentY + 4.8, { align: 'center' });

    // 5. Total Amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.amount.toLocaleString(), colTotalX + colTotalWidth - 2.5, currentY + 4.8, { align: 'right' });

    // UPDATE Y-COORDINATE AFTER EVERY PRODUCT
    currentY += rowHeight;
  }

  // 6. Table Grand Total Footer Row
  if (currentY + totalRowHeight + signatureBlockHeight > pageHeight - marginBottom) {
    doc.addPage();
    currentY = marginTop + 4;
  }

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.setLineWidth(0.4);
  doc.rect(marginLeft, currentY, contentWidth, totalRowHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    isAdmin ? 'TOTAL INVENTORY VALUE:' : 'ORDER GRAND TOTAL:', 
    colPriceX + colPriceWidth - 2.5, 
    currentY + 5.8, 
    { align: 'right' }
  );

  doc.text(`${totalUnits.toLocaleString()} units`, colQtyX + colQtyWidth / 2, currentY + 5.8, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text(`${currencyLabel}${grandTotal.toLocaleString()}`, colTotalX + colTotalWidth - 2.5, currentY + 6, { align: 'right' });

  currentY += totalRowHeight + 10;

  // 7. Signature & Footer Notes
  if (currentY + 18 > pageHeight - marginBottom) {
    doc.addPage();
    currentY = marginTop + 6;
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated automatically via Shondani Medical Hall Business Manager System', marginLeft, currentY);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, marginLeft, currentY + 3.5);

  const sigX = pageWidth - marginRight - 42;
  doc.line(sigX, currentY + 8, pageWidth - marginRight, currentY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Authorized Signature', sigX + 21, currentY + 12, { align: 'center' });

  // 8. Add Page Numbers across all generated pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  // 9. Save / Download
  if (autoDownload && typeof window !== 'undefined') {
    const filename = `${isAdmin ? 'Inventory' : 'Invoice'}-${meta.invoiceNumber || 'SMH-001'}.pdf`;
    doc.save(filename);
  }

  return {
    success: true,
    pageCount: totalPages,
    productCount: validItems.length,
    grandTotal,
    doc,
  };
}
