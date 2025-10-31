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

function escXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}



function buildLabelXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>LW11354</Id>
  <PaperName>11354</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="100" Ry="100"/>
  </DrawCommands>
  <ObjectInfo>
    <BarcodeObject>
      <Name>BARCODE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <Text></Text>
      <Type>Code128Auto</Type>
      <Size>Medium</Size>
      <TextPosition>None</TextPosition>
      <HorizontalAlignment>Center</HorizontalAlignment>
    </BarcodeObject>
    <Bounds X="800" Y="80" Width="2300" Height="600"/>
  </ObjectInfo>
  <ObjectInfo>
    <BarcodeObject>
      <Name>QRCODE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <Text></Text>
      <Type>QRCode</Type>
      <Size>Small</Size>
      <TextPosition>None</TextPosition>
      <ECLevel>5</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
    </BarcodeObject>
    <Bounds X="120" Y="120" Width="520" Height="520"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PV</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <StyledText><Element><String></String><Attributes><Font Family="Arial" Size="9" Bold="True"/></Attributes></Element></StyledText>
    </TextObject>
    <Bounds X="120" Y="700" Width="600" Height="220"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>PVP</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <StyledText><Element><String></String><Attributes><Font Family="Arial" Size="9" Bold="True"/></Attributes></Element></StyledText>
    </TextObject>
    <Bounds X="120" Y="920" Width="600" Height="220"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>TITLE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <StyledText><Element><String></String><Attributes><Font Family="Arial" Size="10" Bold="True"/></Attributes></Element></StyledText>
    </TextObject>
    <Bounds X="780" Y="750" Width="2300" Height="300"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>BATTERY</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <StyledText><Element><String></String><Attributes><Font Family="Arial" Size="9"/></Attributes></Element></StyledText>
    </TextObject>
    <Bounds X="780" Y="1020" Width="2300" Height="240"/>
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>NOTE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>False</UseFullFontHeight>
      <StyledText><Element><String></String><Attributes><Font Family="Arial" Size="8"/></Attributes></Element></StyledText>
    </TextObject>
    <Bounds X="120" Y="1260" Width="2960" Height="460"/>
  </ObjectInfo>
</DieCutLabel>`;
}

function buildLabelSetXml(p: PamProduct) {
  console.log('[DYMO] Building label XML for product:', p);
  console.log('[DYMO] Product ID:', p.id);
  console.log('[DYMO] Product name:', p.name);
  console.log('[DYMO] Serial number:', p.serial_number);
  console.log('[DYMO] IMEI:', p.imei);
  console.log('[DYMO] Battery level:', p.battery_level);
  console.log('[DYMO] Product note:', p.product_note);
  console.log('[DYMO] Retail price:', p.retail_price);
  console.log('[DYMO] Pro price:', p.pro_price);

  const barcode = (p.imei || p.serial_number || '').replace(/\s+/g, '').slice(0, 32) || 'N/A';
  const title = (p.name || '—').slice(0, 40);
  const note = (p.product_note || '').replace(/\r?\n/g, ' ').slice(0, 120);
  const battery = p.battery_level ?? undefined;
  const pv = euro(p.retail_price);
  const pvp = euro(p.pro_price);
  const qr = `gestock://p/${p.id}`;

  console.log('[DYMO] Label data prepared:', { barcode, title, battery, pv, pvp, qr, noteLength: note.length });

  return `<LabelSet>
  <LabelRecord>
    <ObjectData Name="BARCODE">${escXml(barcode)}</ObjectData>
    <ObjectData Name="QRCODE">${escXml(qr)}</ObjectData>
    <ObjectData Name="PV">${escXml('PV ' + pv)}</ObjectData>
    <ObjectData Name="PVP">${escXml('PVP ' + pvp)}</ObjectData>
    <ObjectData Name="TITLE">${escXml(title)}</ObjectData>
    <ObjectData Name="BATTERY">${escXml('BAT: ' + (battery === undefined ? '—' : battery + '%'))}</ObjectData>
    <ObjectData Name="NOTE">${escXml(note)}</ObjectData>
  </LabelRecord>
</LabelSet>`;
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
/** Very small deterministic matrix as placeholder (not a true QR) */
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
function wrapUpper(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineH: number, maxLines: number) {
  const words = (text || '').toUpperCase().split(/\s+/);
  let line = '';
  let lines: string[] = [];
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
  lines.forEach((ln, i) => doc.text(ln, x, y + i * lineH, { align: 'center', maxWidth }));
  return y + (lines.length * lineH);
}

export default function LabelPrintButton({ product }: { product: PamProduct }) {
  const [busy, setBusy] = useState(false);

  async function onPrint() {
    if (busy) {
      console.log('[DYMO] Print already in progress, ignoring click');
      return;
    }

    console.log('[DYMO] Starting print process for product:', product.id);

    // Early validation: need at least serial_number or IMEI to build barcode
    const sn = (product.serial_number || '').trim();
    const imei = (product.imei || '').trim();
    if (!sn && !imei) {
      alert("Impossible d'imprimer: numéro de série/IMEI manquant sur la ligne.\nSélectionnez une ligne avec un n° de série ou IMEI.");
      return;
    }

    setBusy(true);

    try {
      // Nouveau flux imposé: utiliser exclusivement https://localhost:41951
      // 1) Vérifier disponibilité du service DYMO (POST /Check avec Content-Length: 0)
      try {
        const checkRes = await fetch('https://localhost:41951/DYMO/DLS/Printing/Check', {
          method: 'POST',
          headers: { 'Content-Length': '0' }
        });
        if (!checkRes.ok) {
          console.error('[DYMO] Localhost /Check not OK:', checkRes.status);
          alert('Service DYMO non détecté – lancez DYMO Connect for Desktop et autorisez le certificat local.');
          return;
        }
      } catch (err) {
        console.error('[DYMO] Localhost /Check failed:', err);
        alert('Service DYMO non détecté – lancez DYMO Connect for Desktop et autorisez le certificat local.');
        return;
      }

      // 2) Préparer l’étiquette et envoyer la commande d’impression (POST /PrintLabel JSON)
      const labelXml = buildLabelXml();
      const printBody = {
        printerName: 'DYMO LabelWriter 450',
        labelXml,
        copies: 1
      };

      try {
        const res = await fetch('https://localhost:41951/DYMO/DLS/Printing/PrintLabel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(printBody)
        });
        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.error('[DYMO] PrintLabel not OK:', res.status, errorText);
          throw new Error('Échec impression DYMO: ' + res.status);
        }
      } catch (err) {
        console.error('[DYMO] Print request failed:', err);
        throw err;
      }

      // 3) Confirmation
      alert('Étiquette envoyée à l’imprimante');
      return;
    } catch (e) {
      console.error('[DYMO] Error during print:', e);
      alert(
        "Erreur d'impression.\n\n" +
        "Détails: " + (e instanceof Error ? e.message : 'Erreur inconnue') + "\n\n" +
        "Vérifiez la console pour plus d'informations."
      );
    } finally {
      setBusy(false);
      console.log('[DYMO] Print process completed');
    }
  }

  // Nouvelle implémentation 100% PDF côté client (sans DYMO ni appels réseau)
  async function onPrintPDF() {
    if (busy) return;

    const serial = (product.serial_number || product.imei || '').trim();
    if (!serial) {
      alert('Aucune étiquette à générer');
      return;
    }

    setBusy(true);
    try {
      // Étiquette 57×32 mm
      const doc = new jsPDF({ unit: 'mm', format: [57, 32], orientation: 'portrait' });

      // Paramètres de mise en page
      const margin = 2.2;
      const innerW = 57 - margin * 2;

      // Encadré arrondi léger
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, margin, innerW, 32 - margin * 2, 1.2, 1.2);

      // Code-barres sur toute la largeur utile (barre remplie noire)
      const barcodeX = margin + 2;
      const barcodeW = innerW - 4;
      const barcodeH = 6;
      doc.setFillColor(0, 0, 0);
      drawCode39(doc, barcodeX, margin + 1.2, barcodeW, barcodeH, serial);

      // Ligne numéro + type TVA juste en dessous, centré
      const vatLabel = (product.vat_type === 'margin') ? 'TVM' : 'TTC';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`${serial} • ${vatLabel}`, margin + innerW / 2, margin + 1.2 + barcodeH + 3.2, { align: 'center' });

      // QR en haut-gauche
      const qrSize = 12.5;
      const qrX = margin + 1.2;
      const qrY = margin + 1.2 + barcodeH + 5;
      doc.setFillColor(0, 0, 0);
      drawPseudoMatrix(doc, qrX, qrY, qrSize, `/?page=mobile-actions&id=${product.id}`);

      // PV / PVP sous le QR (petit)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      const pv = euro(product.retail_price ?? null);
      const pvp = euro(product.pro_price ?? null);
      const pvY = qrY + qrSize + 2.2;
      doc.text(`PV: ${pv}`, qrX, pvY);
      doc.text(`PVP: ${pvp}`, qrX, pvY + 3.2);

      // Bloc central (à droite du QR) — nom produit (MAJ), puis BAT si dispo
      const textLeft = qrX + qrSize + 2.5;
      const textWidth = margin + innerW - textLeft - 1.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const startTextY = qrY + 2.4;
      const afterNameY = wrapUpper(doc, (product.name || ''), margin + innerW / 2, startTextY, textWidth, 3.4, 2);
      // BAT (facultatif)
      if (typeof product.battery_level === 'number') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`BAT: ${Math.round(product.battery_level)}%`, margin + innerW / 2, afterNameY + 3.6, { align: 'center' });
      }

      // Filet + notes (petit) en bas
      const notesTopY = 32 - margin - 8.0;
      doc.setLineWidth(0.2);
      doc.line(margin + 1.2, notesTopY, margin + innerW - 1.2, notesTopY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      const note = (product.product_note || '').replace(/\r?\n/g, ' ');
      // Wrap manuel très simple par tranches
      const maxChars = 50;
      const n1 = note.slice(0, maxChars);
      const n2 = note.slice(maxChars, maxChars * 2);
      if (n1) doc.text(n1, margin + 1.4, notesTopY + 3.2, { maxWidth: innerW - 2.8 });
      if (n2) doc.text(n2, margin + 1.4, notesTopY + 6.2, { maxWidth: innerW - 2.8 });

      // Ouvrir dans un onglet et proposer impression
      const url = doc.output('bloburl');
      const w = window.open(url, '_blank');
      if (w) {
        setTimeout(() => {
          const go = window.confirm('Souhaitez-vous imprimer toutes les étiquettes maintenant ?');
          if (go) {
            try { w.focus(); setTimeout(() => { try { (w as any).print?.(); } catch {} }, 400); } catch { doc.save('etiquettes.pdf'); }
          }
        }, 300);
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
