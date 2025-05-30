import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DocumentItem } from '../../types/billing';

interface CSVImportArticlesProps {
  onImportComplete: (items: DocumentItem[]) => void;
  documentType: 'quote' | 'invoice' | 'order';
}

export const CSVImportArticles: React.FC<CSVImportArticlesProps> = ({ 
  onImportComplete, 
  documentType 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{headers: string[], rows: string[][]}|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Le fichier doit être au format CSV');
      return;
    }

    setFileName(file.name);
    
    try {
      const text = await file.text();
      setCsvData(text);
      
      // Parse CSV for preview
      const lines = text.split('\n');
      if (lines.length < 2) {
        setError('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Validate required headers
      const requiredHeaders = ['sku', 'quantity'];
      const missingHeaders = requiredHeaders.filter(h => !headers.map(header => header.toLowerCase()).includes(h));
      
      if (missingHeaders.length > 0) {
        setError(`Colonnes obligatoires manquantes : ${missingHeaders.join(', ')}`);
        return;
      }
      
      // Create preview data (first 5 rows)
      const previewRows = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim()));
      setPreviewData({ headers, rows: previewRows });
      
    } catch (err) {
      console.error('Error reading CSV file:', err);
      setError('Erreur lors de la lecture du fichier CSV');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Le fichier doit être au format CSV');
      return;
    }

    setFileName(file.name);
    
    file.text().then(text => {
      setCsvData(text);
      
      // Parse CSV for preview
      const lines = text.split('\n');
      if (lines.length < 2) {
        setError('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Validate required headers
      const requiredHeaders = ['sku', 'quantity'];
      const missingHeaders = requiredHeaders.filter(h => !headers.map(header => header.toLowerCase()).includes(h));
      
      if (missingHeaders.length > 0) {
        setError(`Colonnes obligatoires manquantes : ${missingHeaders.join(', ')}`);
        return;
      }
      
      // Create preview data (first 5 rows)
      const previewRows = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim()));
      setPreviewData({ headers, rows: previewRows });
    }).catch(err => {
      console.error('Error reading CSV file:', err);
      setError('Erreur lors de la lecture du fichier CSV');
    });
  };

  const parseCSV = async () => {
    if (!csvData) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const skuIndex = headers.indexOf('sku');
      const quantityIndex = headers.indexOf('quantity');
      const priceIndex = headers.indexOf('unit_price');
      const descriptionIndex = headers.indexOf('description');
      
      const items: DocumentItem[] = [];
      const errors: string[] = [];
      
      // Process each line (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        const sku = values[skuIndex]?.trim();
        const quantityStr = values[quantityIndex]?.trim();
        const priceStr = priceIndex >= 0 ? values[priceIndex]?.trim() : '';
        const description = descriptionIndex >= 0 ? values[descriptionIndex]?.trim() : '';
        
        if (!sku || !quantityStr) {
          errors.push(`Ligne ${i+1}: SKU ou quantité manquant`);
          continue;
        }
        
        const quantity = parseInt(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Ligne ${i+1}: Quantité invalide "${quantityStr}"`);
          continue;
        }
        
        console.log(`Looking up product with SKU: ${sku}`);
        
        // Look up product by SKU
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, name, retail_price, pro_price')
          .eq('sku', sku)
          .single();
          
        if (productError) {
          console.error(`Error finding product with SKU ${sku}:`, productError);
          errors.push(`Ligne ${i+1}: Produit avec SKU "${sku}" non trouvé`);
          continue;
        }
        
        console.log(`Found product:`, productData);
        
        // Use provided price or default to retail_price
        let unitPrice = 0;
        if (priceStr && !isNaN(parseFloat(priceStr))) {
          unitPrice = parseFloat(priceStr);
        } else if (productData.retail_price) {
          unitPrice = productData.retail_price;
        } else if (productData.pro_price) {
          unitPrice = productData.pro_price;
        } else {
          errors.push(`Ligne ${i+1}: Aucun prix disponible pour le produit "${sku}"`);
          continue;
        }
        
        items.push({
          product_id: productData.id,
          description: description || productData.name || sku,
          quantity,
          unit_price: unitPrice,
          tax_rate: 20, // Default tax rate
          total_price: quantity * unitPrice
        });
      }
      
      if (errors.length > 0) {
        setError(`Des erreurs ont été rencontrées lors de l'importation:\n${errors.join('\n')}`);
      }
      
      setParsedItems(items);
      
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Erreur lors de l\'analyse du fichier CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    if (parsedItems.length > 0) {
      onImportComplete(parsedItems);
      setIsModalOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setCsvData(null);
    setFileName('');
    setParsedItems([]);
    setError(null);
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleCSV = () => {
    const headers = ['sku', 'quantity', 'unit_price', 'description'];
    const sampleData = [
      'IP14PM-128-BLK,2,1200,"iPhone 14 Pro Max 128Go Noir"',
      'SGZFLIP5-256-CREAM,1,950,"Samsung Galaxy Z Flip 5 256Go Cream"'
    ];
    
    const csvContent = [headers.join(','), ...sampleData].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `articles_${documentType}_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        type="button"
      >
        <Upload size={18} />
        Importer CSV
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Importer des articles depuis un fichier CSV</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Importez une liste d'articles à ajouter à votre {
                  documentType === 'quote' ? 'devis' : 
                  documentType === 'invoice' ? 'facture' : 'commande'
                }.
              </p>
              <p className="text-gray-600 mb-4">
                Le fichier CSV doit contenir au minimum les colonnes <strong>sku</strong> et <strong>quantity</strong>.
                Vous pouvez également inclure <strong>unit_price</strong> et <strong>description</strong>.
              </p>
              
              <button
                onClick={downloadSampleCSV}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                <FileText size={16} className="mr-1" />
                Télécharger un modèle CSV
              </button>
            </div>
            
            {!csvData ? (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
                <Upload size={40} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Glissez-déposez votre fichier CSV ici</p>
                <p className="text-gray-500 text-sm">ou</p>
                <button
                  type="button"
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Parcourir
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center bg-blue-50 p-4 rounded-lg">
                  <FileText size={24} className="text-blue-600 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-gray-600">
                      {parsedItems.length > 0 
                        ? `${parsedItems.length} articles trouvés` 
                        : 'Fichier prêt à être analysé'}
                    </p>
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {previewData && !parsedItems.length && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-3 border-b">
                      <h3 className="font-medium">Aperçu des données</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {previewData.headers.map((header, index) => (
                              <th 
                                key={index}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td 
                                  key={cellIndex}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {parsedItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                      <h3 className="font-medium">Articles à importer</h3>
                      <span className="text-sm text-gray-600">{parsedItems.length} articles</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quantité
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Prix unitaire HT
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total HT
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {parsedItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.unit_price.toFixed(2)} €
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.total_price.toFixed(2)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                    <AlertTriangle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                    <div className="whitespace-pre-line">{error}</div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  
                  {!parsedItems.length ? (
                    <button
                      type="button"
                      onClick={parseCSV}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                      disabled={isLoading || !csvData}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyse en cours...
                        </>
                      ) : (
                        <>
                          <FileText size={18} className="mr-2" />
                          Analyser le fichier
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleImport}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                    >
                      <Check size={18} className="mr-2" />
                      Importer {parsedItems.length} articles
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};