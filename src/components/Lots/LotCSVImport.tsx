import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Check, AlertTriangle, Download } from 'lucide-react';
import { useLotStore } from '../../store/lotStore';

interface LotCSVImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const LotCSVImport: React.FC<LotCSVImportProps> = ({ 
  isOpen, 
  onClose, 
  onImportComplete 
}) => {
  const { importLotsFromCSV, isLoading, error } = useLotStore();
  
  const [csvData, setCsvData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<{headers: string[], rows: string[][]}|null>(null);
  const [importResult, setImportResult] = useState<{success: boolean, errors: string[]} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Le fichier doit être au format CSV');
      return;
    }

    setFileName(file.name);
    
    try {
      const text = await file.text();
      setCsvData(text);
      
      // Parse CSV for preview
      const lines = text.split('\n');
      if (lines.length < 2) {
        alert('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Validate required headers
      const requiredHeaders = ['sku_parent', 'quantite_par_lot', 'marge'];
      const missingHeaders = requiredHeaders.filter(h => !headers.map(header => header.toLowerCase()).includes(h));
      
      if (missingHeaders.length > 0) {
        alert(`Colonnes obligatoires manquantes : ${missingHeaders.join(', ')}`);
        return;
      }
      
      // Create preview data (first 5 rows)
      const previewRows = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim()));
      setPreviewData({ headers, rows: previewRows });
      
    } catch (err) {
      console.error('Error reading CSV file:', err);
      alert('Erreur lors de la lecture du fichier CSV');
    }
  };

  const handleImport = async () => {
    if (!csvData) return;
    
    try {
      console.log('Starting CSV import...');
      const result = await importLotsFromCSV(csvData);
      setImportResult(result);
      
      if (result.success) {
        setTimeout(() => {
          onImportComplete();
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Error importing CSV:', err);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = 'sku_parent,quantite_par_lot,marge,sku_lot,nom_lot\nIPH14PM-128-BLK,10,50,LOT10-IPH14PM,"Lot de 10 iPhone 14 Pro Max"\nSGS23-256-WHT,5,30,,';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lots_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setCsvData(null);
    setFileName('');
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Importer des lots depuis un fichier CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            Importez des lots simples à partir d'un fichier CSV.
          </p>
          <p className="text-gray-600 mb-4">
            Le fichier CSV doit contenir les colonnes : <strong>sku_parent</strong>, <strong>quantite_par_lot</strong>, <strong>marge</strong>.
            Les colonnes <strong>sku_lot</strong> et <strong>nom_lot</strong> sont optionnelles.
          </p>
          
          <button
            onClick={downloadSampleCSV}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
          >
            <Download size={16} className="mr-1" />
            Télécharger un modèle CSV
          </button>
        </div>
        
        {!importResult ? (
          <>
            {!csvData ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
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
                  onClick={() => fileInputRef.current?.click()}
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
                    <p className="text-sm text-gray-600">Fichier prêt à être importé</p>
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {previewData && (
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
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleImport}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Import en cours...
                      </>
                    ) : (
                      <>
                        <Check size={18} className="mr-2" />
                        Importer les lots
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            {importResult.success ? (
              <div className="text-green-600">
                <Check size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Import réussi</h3>
                <p>Les lots ont été importés avec succès</p>
              </div>
            ) : (
              <div className="text-red-600">
                <AlertTriangle size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Erreurs d'import</h3>
                <div className="text-left max-w-md mx-auto">
                  {importResult.errors.map((error, index) => (
                    <p key={index} className="text-sm mb-1">• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};