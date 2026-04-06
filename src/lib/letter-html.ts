// Shared HTML template for the printed Dear Neighbor letter.
// Used by both the Lob send route and the PDF generation route so the
// physical and downloadable letters look identical.

export interface ReturnAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildLetterHtml(opts: {
  letterText: string;
  qrDataUrl: string;
  buyerName: string;
  returnAddress: ReturnAddress;
}): string {
  const { letterText, qrDataUrl, buyerName, returnAddress } = opts;
  const safeLetter = escapeHtml(letterText).replace(/\n/g, "<br/>");
  const returnLine2 = [returnAddress.street, returnAddress.unit].filter(Boolean).join(", ");
  const returnLine3 = `${returnAddress.city}, ${returnAddress.state} ${returnAddress.zip}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Letter</title>
<style>
  @page { size: 8.5in 11in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #0f1f3d;
    width: 8.5in;
    height: 11in;
    box-sizing: border-box;
    padding: 1in 1in 0.75in 1in;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    text-align: center;
    font-family: Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    color: #0f1f3d;
    letter-spacing: -0.01em;
    margin-bottom: 0.45in;
    border-bottom: 1px solid #c9a84c;
    padding-bottom: 0.18in;
  }
  .letter {
    font-size: 12pt;
    line-height: 1.55;
    color: #0f1f3d;
    white-space: normal;
  }
  .qr-block {
    margin-top: 0.4in;
    text-align: center;
  }
  .qr-block img {
    width: 1.6in;
    height: 1.6in;
  }
  .qr-caption {
    margin-top: 0.1in;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #c9a84c;
    font-weight: 600;
  }
  .return {
    position: absolute;
    bottom: 0.5in;
    left: 1in;
    right: 1in;
    text-align: center;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 8pt;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.1in;
  }
</style>
</head>
<body>
  <div class="header">Dear \u00b7 Neighbor</div>

  <div class="letter">${safeLetter}</div>

  <div class="qr-block">
    <img src="${qrDataUrl}" alt="QR code" />
    <div class="qr-caption">Scan to respond directly to ${escapeHtml(buyerName)}</div>
  </div>

  <div class="return">
    ${escapeHtml(buyerName)} \u00b7 ${escapeHtml(returnLine2)} \u00b7 ${escapeHtml(returnLine3)}
  </div>
</body>
</html>`;
}
