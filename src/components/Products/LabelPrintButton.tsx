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
      // Page étiquette 62×100 mm (DYMO) en mm
      const doc = new jsPDF({ unit: 'mm', format: [62, 100], orientation: 'portrait' });

      // Données
      const sku = (((product as any)?.sku) || product.id || '').toString().toUpperCase();
      const name = (product.name || '').toString();
      const qty = 1;
      const unit = Number((product.retail_price ?? product.pro_price) || 0);
      const total = unit * qty;

      // Bordure/encadré
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.rect(3, 3, 56, 94);

      // En-têtes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Étiquette produit', 31, 9, { align: 'center' });

      // Bloc infos texte
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lineX = 6;
      let y = 16;

      doc.text(`SKU: ${sku || '—'}`, lineX, y); y += 5;
      doc.text(`Nom: ${name.slice(0, 40)}`, lineX, y); y += 5;
      doc.text(`N° série: ${serial}`, lineX, y); y += 5;
      doc.text(`Qté: ${qty}`, lineX, y); y += 5;
      doc.text(`PU: ${euro(unit)}`, lineX, y); y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${euro(total)}`, lineX, y); y += 6;

      // “Pseudo” code (grille binaire) à partir du numéro de série (sans dépendance externe)
      // Ce n'est pas un QR scannable, mais donne un rendu visuel compact.
      const gridSize = 16;
      const cell = 2.5; // mm
      const startX = 6;
      const startY = 50;
      // Petit hash déterministe
      let h = 0;
      for (let i = 0; i < serial.length; i++) {
        h = (h * 33 + serial.charCodeAt(i)) >>> 0;
      }
      doc.setDrawColor(0);
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          // Décider de remplir la case selon un bit du hash “mixé”
          const bit = ((h >> ((r + c) % 31)) ^ ((r * 17 + c * 13) & 1)) & 1;
          if (bit) {
            doc.setFillColor(0, 0, 0);
            doc.rect(startX + c * cell, startY + r * cell, cell - 0.2, cell - 0.2, 'F');
          }
        }
      }
      // Légende sous la grille
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`SN: ${serial}`, startX, startY + gridSize * cell + 4);

      // Ouvrir dans un nouvel onglet et proposer d'imprimer
      const url = doc.output('bloburl');
      const w = window.open(url, '_blank');

      if (w) {
        setTimeout(() => {
          const go = window.confirm('Souhaitez-vous imprimer toutes les étiquettes maintenant ?');
          if (go) {
            try {
              w.focus();
              // Certains navigateurs ne déclenchent l’impression qu’une fois le PDF chargé
              setTimeout(() => {
                try { (w as any).print?.(); } catch {}
              }, 400);
            } catch {
              // Fallback téléchargement si impression indisponible
              doc.save('etiquettes.pdf');
            }
          }
        }, 500);
      } else {
        // Popup bloquée → téléchargement direct
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
