import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';

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

// Prix sans symbole € et sans décimales
function prixInt(v?: number | null) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(v));
}

// Normalise la valeur stockée en BD vers l'étiquette 'TVM' ou 'TTC'
function computeVatLabel(raw?: string | null): 'TVM' | 'TTC' {
  const v = (raw ?? '').toString().trim().toLowerCase();
  if (['margin', 'tvm', 'marge', 'margin_scheme', 'margin-based', 'mrgn'].includes(v)) return 'TVM';
  if (['normal', 'ttc', 'standard', 'std'].includes(v)) return 'TTC';
  // Valeur inattendue: par défaut TTC (régime normal)
  return 'TTC';
}

// Récupère le vat_type au niveau "série" (ligne produit portant serial_number/IMEI)
async function getSerialVatType(product: PamProduct): Promise<string | null> {
  const bySerial = (product.serial_number || '').trim();
  const byImei = (product.imei || '').trim();

  // Si le composant reçoit déjà la bonne ligne "série" avec vat_type, on peut la renvoyer telle quelle
  if (product.vat_type && (bySerial || byImei)) {
    // On vérifie tout de même via BD si nécessaire; on peut court-circuiter si vous préférez éviter la requête
    // return product.vat_type;
  }

  // Requête prioritaire par serial_number, sinon par imei
  let query = supabase.from('products').select('vat_type').limit(1);
  if (bySerial) {
    query = query.eq('serial_number', bySerial);
  } else if (byImei) {
    query = query.eq('imei', byImei);
  } else {
    // Pas d'identifiant série: fallback au champ fourni
    return product.vat_type ?? null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn('[LabelPrint] getSerialVatType: fallback (error)', error);
    return product.vat_type ?? null;
  }
  return (data as any)?.vat_type ?? product.vat_type ?? null;
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
      // Crée un document PDF 57x32 mm (même mise en forme que pdf.html)
      const doc = new jsPDF({ unit: 'mm', orientation: 'landscape', format: [32, 57] });
      // === Layout constants ===
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const m = 2.0, innerW = W - m*2;
      const xL = m, xR = m + innerW;

      // Résolution du régime TVA au niveau série
      const vatRaw = await getSerialVatType(product);
      const vat = computeVatLabel(vatRaw);

      // cadre
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.roundedRect(m, m, innerW, H - m*2, 1.2, 1.2);

      // QR (vrai QR avec deeplink gestock://product/{serial})
      const qrSize = 10.5, qrX = m + 1.2, qrY = m + 1.1;
      const deeplink = `gestock://product/${serial}`;
      const { toDataURL } = await import('qrcode');
      const qrDataUrl = await toDataURL(deeplink, { errorCorrectionLevel: 'M', margin: 0, scale: 8 });
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // BARCODE — top row, full width to the right of QR, half height
      const quiet = 2.0, gap = 2.0, bcH = 5.2, bcTopY = qrY;
      const bcX = qrX + qrSize + gap;
      const bcW = (xR - 1.2) - bcX;
      doc.setFillColor(0,0,0);
      drawCode39(doc, bcX + quiet, bcTopY, bcW - quiet * 2, bcH, serial);

      doc.setFont('courier','bold'); doc.setFontSize(7.4);
      const serialTextY = bcTopY + bcH + 3.0;
      (doc as any).text(`${serial}  ${vat}`, bcX + bcW - quiet, serialTextY, { align: 'right' });

      // PV/PVP (sans € et sans décimales)
      doc.setFont('helvetica','normal'); doc.setFontSize(6.0);
      (doc as any).text(`PV:  ${prixInt(product.retail_price)}`,  qrX, qrY + qrSize + 2.4, { align: 'left' });
      (doc as any).text(`PVP: ${prixInt(product.pro_price)}`, qrX, qrY + qrSize + 5.2, { align: 'left' });

      // Nom produit colonne à droite du QR, début sous le QR et sous série+TVA
      const gapRightOfQR = 2.0;
      const txL = qrX + qrSize + gapRightOfQR, txR = xR - 1.4, txW = txR - txL;
      doc.setFont('helvetica','bold'); doc.setFontSize(6.0);
      const name = String(product.name || '').toUpperCase();
      const lines = doc.splitTextToSize(String(name), Number(txW)) as string[];
      let yText = Math.max(qrY + qrSize + 2.0, serialTextY + 2.8);
      (lines.slice(0,3)).forEach(ln => { (doc as any).text(String(ln), txL, yText); yText += 2.7; });

      // BAT centré sous le nom, même taille, avec butée avant notes
      if (typeof product.battery_level === 'number') {
        doc.setFont('helvetica','bold'); doc.setFontSize(6.0);
        const batX = (txL + txR) / 2;
        const padFromText = 5.0;
        const safePadToNotes = 0.5;
        const notesTopYSafe = H - m - 8.8;
        let batY = yText + padFromText;
        batY = Math.min(batY, notesTopYSafe - safePadToNotes);
        (doc as any).text(`BAT: ${Math.round(product.battery_level)}%`, batX, batY, { align: 'center' });
        yText = batY;
      }

      // Notes remontées + enveloppe dynamique
      const notesTopY = H - m - 8.8;
      doc.setLineWidth(0.2); doc.line(m + 1.0, notesTopY, xR - 1.0, notesTopY);

      doc.setFont('helvetica','normal'); doc.setFontSize(6.0);
      const textNotes = String((product.product_note || '').replace(/\r?\n/g, ' ')).toUpperCase();
      const rawNotes = doc.splitTextToSize(textNotes, innerW - 2.4) as string[];
      const lineH = 2.8;
      const topPad = 2.0;
      const avail = (H - m) - (notesTopY + topPad);
      const maxLines = Math.max(1, Math.floor(avail / lineH));
      const notes = rawNotes.slice(0, maxLines);
      let ny = notesTopY + topPad; notes.forEach(ln => { (doc as any).text(String(ln), m + 1.2, ny); ny += lineH; });

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
