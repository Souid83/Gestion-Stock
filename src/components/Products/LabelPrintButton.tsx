import React, { useState } from 'react';

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

async function dymoFetch(path: string, init?: RequestInit) {
  console.log('[DYMO] Attempting fetch to:', path);
  const httpsUrl = `https://127.0.0.1:41951${path}`;
  const httpUrl = `http://127.0.0.1:41951${path}`;
  try {
    const response = await fetch(httpsUrl, { ...init, mode: 'cors' });
    console.log('[DYMO] HTTPS request successful', { url: httpsUrl, status: response.status });
    return response;
  } catch (errHttps: any) {
    console.warn('[DYMO] HTTPS request failed:', errHttps?.message || errHttps);
    try {
      if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
        console.warn('[DYMO] HTTP fallback may be blocked due to mixed content (site served over HTTPS).');
      }
      const response = await fetch(httpUrl, { ...init, mode: 'cors' });
      console.log('[DYMO] HTTP fallback successful', { url: httpUrl, status: response.status });
      return response;
    } catch (errHttp: any) {
      const hint =
        (typeof window !== 'undefined' && window.location?.protocol === 'https:')
          ? 'Possible mixed content blocked or untrusted localhost certificate. Try trusting https://127.0.0.1:41951 in the browser or serve app over HTTP on LAN.'
          : 'DYMO Web Service not running or unreachable on 127.0.0.1:41951.';
      const composed = `[DYMO] Both HTTPS (${httpsUrl}) and HTTP (${httpUrl}) attempts failed. Hint: ${hint}. HTTPS error: ${errHttps?.message || errHttps}. HTTP error: ${errHttp?.message || errHttp}.`;
      console.error(composed);
      throw new Error(composed);
    }
  }
}

async function chooseDymoPrinter(): Promise<string | null> {
  console.log('[DYMO] Fetching connected printers...');
  const status = await dymoFetch('/DYMO/DLS/Printing/StatusConnectedPrinters');
  if (!status.ok) {
    console.error('[DYMO] Failed to fetch printer status');
    return null;
  }

  const data = await status.json();
  console.log('[DYMO] Printer status response:', data);

  const printers: Array<{ Name: string; ModelName: string; IsConnected: boolean }> =
    data?.Printers ?? [];

  const lw450 = printers.filter(p => /LabelWriter/i.test(p.ModelName || p.Name));
  console.log('[DYMO] Found LabelWriter printers:', lw450);

  if (lw450.length === 0) {
    console.warn('[DYMO] No LabelWriter printers found');
    return null;
  }

  const pref = lw450.find(p => /450/i.test(p.ModelName || p.Name)) || lw450[0];
  console.log('[DYMO] Selected printer:', pref.Name);

  return pref.Name;
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
      console.log('[DYMO] Step 1: Checking if DYMO service is running...');
      const ping = await dymoFetch('/DYMO/DLS/Printing/IsWebServiceRunning');

      if (!ping.ok) {
        console.error('[DYMO] Service ping failed');
        alert(
          "Service DYMO indisponible.\n\n" +
          "Veuillez vérifier:\n" +
          "1. DYMO Connect est installé\n" +
          "2. Le service DYMO est démarré\n" +
          "3. L'imprimante DYMO LabelWriter 450 est connectée"
        );
        return;
      }

      const pingResult = await ping.text();
      console.log('[DYMO] Service ping result:', pingResult);

      console.log('[DYMO] Step 2: Selecting printer...');
      const printer = await chooseDymoPrinter();

      if (!printer) {
        console.error('[DYMO] No printer found');
        alert(
          "Aucune DYMO LabelWriter détectée.\n\n" +
          "Veuillez vérifier:\n" +
          "1. L'imprimante DYMO LabelWriter 450 est connectée via USB\n" +
          "2. L'imprimante est allumée\n" +
          "3. Les pilotes DYMO sont installés"
        );
        return;
      }

      console.log('[DYMO] Step 3: Preparing print job...');
      const labelXml = buildLabelXml();
      const labelSetXml = buildLabelSetXml(product);

      console.log('[DYMO] Label XML length:', labelXml.length);
      console.log('[DYMO] LabelSet XML length:', labelSetXml.length);

      const body = new URLSearchParams({
        printerName: printer,
        printParamsXml: '',
        labelXml: labelXml,
        labelSetXml: labelSetXml
      });

      console.log('[DYMO] Step 4: Sending print job to printer...');
      const res = await dymoFetch('/DYMO/DLS/Printing/PrintLabel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[DYMO] Print failed:', errorText);
        throw new Error('Échec impression DYMO: ' + res.status);
      }

      const result = await res.text();
      console.log('[DYMO] Print result:', result);
      console.log('[DYMO] Print successful!');

      alert(`Étiquette envoyée à ${printer}\n\nProduit: ${product.name || 'N/A'}\nN° série: ${product.serial_number || product.imei || 'N/A'}`);
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

  return (
    <button
      type="button"
      onClick={onPrint}
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
