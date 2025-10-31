import React, { useState } from 'react';
import { jsPDF } from 'jspdf';

type PamProduct = {
  id: string;
  name?: string | null;
  serial_number?: string | null;
  imei?: string | null;
  battery_level?: number | null;
  product_note?: string | null;
  retail_price?: number | null;
  pro_price?: number | null;
  vat_type?: 'normal' | 'margin' | string | null;
};

function euro(v?: number | null) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  }).format(v);
}

/**
 * Code39 patterns (n = narrow, w = wide) for supported characters
 * Bars and spaces alternate, pattern starts with a bar element
 */
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn' // start/stop
};

function toCode39Text(v: string) {
  const cleaned = v.toUpperCase().replace(/[^0-9A-Z.\- /+$%]/g, '');
  return `*${cleaned}*`;
}

function drawCode39(doc: jsPDF, x: number, y: number, w: number, h: number, value: string) {
  const text = toCode39Text(value);
  const narrow = 1; // unit
  const wide = 3;   // unit
  // compute total units
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const pat = CODE39[text[i]] || CODE39['-'];
    for (let j = 0; j < pat.length; j++) units += (pat[j] === 'w' ? wide : narrow);
    if (i !== text.length - 1) units += narrow; // inter-char space
  }
  const unitW = w / units;
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const pat = CODE39[text[i]] || CODE39['-'];
    for (let j = 0; j < pat.length; j++) {
      const isBar = (j % 2 === 0);
      const ww = (pat[j] === 'w' ? wide : narrow) * unitW;
      if (isBar) {
        doc.rect(cx, y, ww, h, 'F');
      }
      cx += ww;
    }
    if (i !== text.length - 1) cx += narrow * unitW; // inter-char space
  }
}

/** Minimal deterministic matrix as placeholder (not a true QR) */
function drawPseudoMatrix(doc: jsPDF, x: number, y: number, size: number, seed: string) {
  const grid = 21;
  const cell = size / grid;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619 >>> 0;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const bit = ((h >> ((r * 3 + c) % 31)) ^ ((r + c) & 1)) & 1;
      if (bit) {
        doc.rect(x + c * cell, y + r * cell, cell * 0.95, cell * 0.95, 'F');
      }
    }
  }
}

/** Wrap uppercased text with left alignment */
function wrapUpperLeft(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineH: number,
  maxLines: number
) {
  const words = (text || '').toUpperCase().split(/\s+/);
  let line = '';
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (doc.getTextWidth(test) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((ln, i) => doc.text(ln, x, y + i * lineH, { align: 'left', maxWidth }));
  return y + (lines.length * lineH);
}

export default function LabelPrintButton({ product }: { product: PamProduct }) {
  const [busy, setBusy] = useState(false);

  // Nouvelle implémentation 100% PDF côté client (sans DYMO ni appels réseau)
  async function onPrintPDF() {
    if (busy) return;

    const serial = (product.imei || product.serial_number || '').trim();
    if (!serial) {
      alert('Aucune étiquette à générer');
      return;
    }

    setBusy(true);
    try {
      // Crée un document PDF 57x32 mm
      const doc = new jsPDF({ unit: 'mm', format: [57, 32], orientation: 'portrait' });
      // === Layout constants ===
      const W = 57, H = 32;
      const m = 2.0, innerW = W - m*2;
      const xL = m, xR = m + innerW;

      // cadre
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.roundedRect(m, m, innerW, H - m*2, 1.2, 1.2);

      // --- BARCODE on top ---
      const vat = product.vat_type === "margin" ? "TVM" : "TTC";
      const bcX = m + 1.2;
      const bcW = innerW - 2.4;
      const bcH = 9.5;                 // plus haut
      const quiet = 0.8;               // quiet zones latérales
      doc.setFillColor(0,0,0);
      drawCode39(doc, bcX + quiet, m + 1.1, bcW - quiet*2, bcH, serial);

      // texte lisible sous le code-barres (mono, aligné à gauche)
      doc.setFont("courier", "bold"); doc.setFontSize(7.2);
      doc.text(`${serial}  ${vat}`, bcX, m + 1.1 + bcH + 3.0, { align: "left" });

      // --- QR + PV/PVP à gauche ---
      const qrSize = 10.5;
      const qrX = m + 1.2;
      const qrY = m + 1.1 + bcH + 5.0;
      doc.setFillColor(0,0,0);
      drawPseudoMatrix(doc, qrX, qrY, qrSize, `/?page=mobile-actions&id=${product.id}`);

      doc.setFont("helvetica", "normal"); doc.setFontSize(7.0);
      const pv = euro(product.retail_price);
      const pvp = euro(product.pro_price);
      doc.text(`PV:  ${pv}`, qrX, qrY + qrSize + 2.4, { align: "left" });
      doc.text(`PVP: ${pvp}`, qrX, qrY + qrSize + 5.2, { align: "left" });

      // --- Bloc titre à droite du QR ---
      const txL = qrX + qrSize + 2.0;
      const txW = xR - 1.4 - txL;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8);
      const name = (product.name || "").toUpperCase();
      const lines = doc.splitTextToSize(name, txW);
      const maxLines = 3;
      const used = (Array.isArray(lines) ? lines : [String(lines)]).slice(0, maxLines);
      let yText = qrY + 1.8;
      used.forEach((ln: string) => { doc.text(ln, txL, yText); yText += 3.4; });

      // BAT à droite du bloc titre
      if (typeof product.battery_level === "number") {
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.0);
        doc.text(`BAT: ${Math.round(product.battery_level)}%`, xR - 1.4, yText, { align: "right" });
      }

      // --- Notes en bas ---
      const notesTopY = H - m - 8.4;
      doc.setLineWidth(0.2);
      doc.line(m + 1.0, notesTopY, xR - 1.0, notesTopY);

      doc.setFont("helvetica", "normal"); doc.setFontSize(6.0);
      const noteRaw = (product.product_note || "").replace(/\r?\n/g, " ").toUpperCase();
      const noteLines = doc.splitTextToSize(noteRaw, innerW - 2.4) as string[];
      const noteUsed = (Array.isArray(noteLines) ? noteLines : [String(noteLines)]).slice(0, 3);
      let ny = notesTopY + 2.6;
      noteUsed.forEach((ln: string) => { doc.text(ln, m + 1.2, ny); ny += 2.8; });

      // Ouvrir dans un onglet et proposer impression
      const url = doc.output('bloburl');
      const w = window.open(url, '_blank');
      if (w) {
        setTimeout(() => {
          const go = window.confirm('Souhaitez-vous imprimer toutes les étiquettes maintenant ?');
          if (go) {
            try { w.focus(); setTimeout(() => { try { (w as any).print?.(); } catch {} }, 350); } catch { doc.save('etiquettes.pdf'); }
          }
        }, 250);
      } else {
        doc.save('etiquettes.pdf');
      }
    } catch (e) {
      console.error('[PDF] Erreur génération étiquette:', e);
      alert("Erreur lors de la génération du PDF d'étiquettes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onPrintPDF}
      title="Imprimer l'étiquette (57×32 mm)"
      disabled={busy}
      className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9V2h12v7M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2m-12 0v5h12v-5H6Z"/>
      </svg>
      <span className="text-xs">Imprimer étiquette</span>
    </button>
  );
}
