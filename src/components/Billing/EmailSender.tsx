import React, { useState, useEffect } from 'react';
import { X, Send, Settings, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useMailSettingsStore } from '../../store/mailSettingsStore';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface EmailSenderProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'quote' | 'order' | 'invoice' | 'credit_note';
  documentId: string;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  documentRef: React.RefObject<HTMLDivElement>;
  additionalData?: {
    expiryDate?: string;
    dueDate?: string;
    totalAmount?: number;
    invoiceNumber?: string;
  };
}

export const EmailSender: React.FC<EmailSenderProps> = ({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentNumber,
  customerName,
  customerEmail,
  documentRef,
  additionalData
}) => {
  const { settings, fetchSettings, getTemplateForDocumentType, isLoading, error } = useMailSettingsStore();
  
  const [emailData, setEmailData] = useState({
    to: customerEmail,
    subject: '',
    message: '',
    attachPdf: true
  });
  
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Load mail settings on mount
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);
  
  // Set default subject based on document type
  useEffect(() => {
    if (isOpen) {
      let subject = '';
      
      switch (documentType) {
        case 'quote':
          subject = `Devis ${documentNumber}`;
          break;
        case 'order':
          subject = `Commande ${documentNumber}`;
          break;
        case 'invoice':
          subject = `Facture ${documentNumber}`;
          break;
        case 'credit_note':
          subject = `Avoir ${documentNumber}`;
          break;
      }
      
      setEmailData(prev => ({ ...prev, subject }));
    }
  }, [isOpen, documentType, documentNumber]);
  
  // Set default message based on document type and template
  useEffect(() => {
    if (isOpen) {
      const template = getTemplateForDocumentType(documentType);
      
      // Replace placeholders with actual values
      let message = template
        .replace(/{customer_name}/g, customerName)
        .replace(/{document_number}/g, documentNumber)
        .replace(/{company_name}/g, 'Votre Entreprise');
      
      // Replace additional placeholders based on document type
      if (documentType === 'quote' && additionalData?.expiryDate) {
        message = message.replace(/{expiry_date}/g, additionalData.expiryDate);
      }
      
      if (documentType === 'invoice' && additionalData?.dueDate) {
        message = message.replace(/{due_date}/g, additionalData.dueDate);
      }
      
      if ((documentType === 'invoice' || documentType === 'credit_note') && additionalData?.totalAmount) {
        const formattedAmount = new Intl.NumberFormat('fr-FR', { 
          style: 'currency', 
          currency: 'EUR' 
        }).format(additionalData.totalAmount);
        
        message = message.replace(/{total_amount}/g, formattedAmount);
      }
      
      if (documentType === 'credit_note' && additionalData?.invoiceNumber) {
        message = message.replace(/{invoice_number}/g, additionalData.invoiceNumber);
      }
      
      setEmailData(prev => ({ ...prev, message }));
    }
  }, [isOpen, documentType, getTemplateForDocumentType, customerName, documentNumber, additionalData]);
  
  // Generate PDF when component mounts
  useEffect(() => {
    if (isOpen && documentRef.current) {
      generatePDF();
    }
  }, [isOpen, documentRef]);
  
  const generatePDF = async () => {
    if (!documentRef.current) return;
    
    try {
      console.log('Generating PDF...');
      
      const element = documentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions based on the canvas
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add new pages if the content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Get the PDF as a blob
      const blob = pdf.output('blob');
      setPdfBlob(blob);
      
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setStatusMessage('Erreur lors de la génération du PDF');
      setSendStatus('error');
    }
  };
  
  const handleDownloadPDF = () => {
    if (!pdfBlob) {
      generatePDF().then(() => {
        if (pdfBlob) {
          downloadPDF();
        }
      });
      return;
    }
    
    downloadPDF();
  };
  
  const downloadPDF = () => {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Set filename based on document type
    let filename = '';
    switch (documentType) {
      case 'quote':
        filename = `Devis_${documentNumber}.pdf`;
        break;
      case 'order':
        filename = `Commande_${documentNumber}.pdf`;
        break;
      case 'invoice':
        filename = `Facture_${documentNumber}.pdf`;
        break;
      case 'credit_note':
        filename = `Avoir_${documentNumber}.pdf`;
        break;
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleSendEmail = async () => {
    if (!settings) {
      setStatusMessage('Veuillez configurer les paramètres SMTP');
      setSendStatus('error');
      return;
    }
    
    if (!emailData.to) {
      setStatusMessage('Veuillez spécifier une adresse email de destination');
      setSendStatus('error');
      return;
    }
    
    setSendStatus('sending');
    setStatusMessage('Envoi en cours...');
    
    try {
      console.log('Sending email with data:', emailData);
      console.log('Using SMTP settings:', settings);
      
      // In a real application, we would call a serverless function to send the email
      // For now, we'll just simulate a successful email send
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success
      console.log('Email sent successfully');
      setSendStatus('success');
      setStatusMessage('Email envoyé avec succès');
      
      // In a real application, we would also update the document status to 'sent'
      // For now, we'll just log it
      console.log(`Document ${documentType} ${documentId} status should be updated to 'sent'`);
      
    } catch (error) {
      console.error('Error sending email:', error);
      setSendStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'envoi de l\'email');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Envoyer par email
            {documentType === 'quote' && ' - Devis'}
            {documentType === 'order' && ' - Commande'}
            {documentType === 'invoice' && ' - Facture'}
            {documentType === 'credit_note' && ' - Avoir'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        {!settings && !showSettings ? (
          <div className="text-center py-8">
            <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Configuration SMTP requise</h3>
            <p className="text-gray-600 mb-6">
              Vous devez configurer les paramètres SMTP avant de pouvoir envoyer des emails.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Configurer maintenant
            </button>
          </div>
        ) : showSettings ? (
          <MailSettingsForm 
            initialSettings={settings}
            onSave={(savedSettings) => {
              setShowSettings(false);
            }}
            onCancel={() => setShowSettings(false)}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Paramètres d'envoi</h3>
              <button
                onClick={() => setShowSettings(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              >
                <Settings size={16} className="mr-1" />
                Configurer SMTP
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinataire
                </label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sujet
                </label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="attachPdf"
                  checked={emailData.attachPdf}
                  onChange={(e) => setEmailData(prev => ({ ...prev, attachPdf: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="attachPdf" className="ml-2 block text-sm text-gray-900">
                  Joindre le document en PDF
                </label>
              </div>
            </div>
            
            {sendStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle size={20} className="mr-2" />
                {statusMessage}
              </div>
            )}
            
            {sendStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
                <CheckCircle size={20} className="mr-2" />
                {statusMessage}
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Download size={18} className="mr-2" />
                Télécharger PDF
              </button>
              
              <button
                type="button"
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                disabled={sendStatus === 'sending'}
              >
                {sendStatus === 'sending' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MailSettingsFormProps {
  initialSettings: MailSettings | null;
  onSave: (settings: MailSettings) => void;
  onCancel: () => void;
}

const MailSettingsForm: React.FC<MailSettingsFormProps> = ({
  initialSettings,
  onSave,
  onCancel
}) => {
  const { saveSettings, testConnection, isLoading, error } = useMailSettingsStore();
  
  const [formData, setFormData] = useState<MailSettings>({
    id: initialSettings?.id,
    smtp_host: initialSettings?.smtp_host || '',
    smtp_port: initialSettings?.smtp_port || 587,
    smtp_user: initialSettings?.smtp_user || '',
    smtp_password: initialSettings?.smtp_password || '',
    from_email: initialSettings?.from_email || '',
    from_name: initialSettings?.from_name || '',
    quote_template: initialSettings?.quote_template,
    order_template: initialSettings?.order_template,
    invoice_template: initialSettings?.invoice_template,
    credit_note_template: initialSettings?.credit_note_template
  });
  
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const savedSettings = await saveSettings(formData);
      if (savedSettings) {
        onSave(savedSettings);
      }
    } catch (err) {
      console.error('Error saving mail settings:', err);
    }
  };
  
  const handleTestConnection = async () => {
    setTestStatus(null);
    const result = await testConnection(formData);
    setTestStatus(result);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serveur SMTP
            </label>
            <input
              type="text"
              name="smtp_host"
              value={formData.smtp_host}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="smtp.example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port SMTP
            </label>
            <input
              type="number"
              name="smtp_port"
              value={formData.smtp_port}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="587"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom d'utilisateur SMTP
            </label>
            <input
              type="text"
              name="smtp_user"
              value={formData.smtp_user}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="user@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe SMTP
            </label>
            <input
              type="password"
              name="smtp_password"
              value={formData.smtp_password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email expéditeur
            </label>
            <input
              type="email"
              name="from_email"
              value={formData.from_email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="contact@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom expéditeur
            </label>
            <input
              type="text"
              name="from_name"
              value={formData.from_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Votre Entreprise"
              required
            />
          </div>
        </div>
      </div>
      
      {testStatus && (
        <div className={`p-4 rounded-lg ${
          testStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testStatus.success ? (
            <div className="flex items-center">
              <CheckCircle size={20} className="mr-2" />
              {testStatus.message}
            </div>
          ) : (
            <div className="flex items-center">
              <AlertCircle size={20} className="mr-2" />
              {testStatus.message}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={handleTestConnection}
          className="px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
          disabled={isLoading}
        >
          Tester la connexion
        </button>
        
        <div className="space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={isLoading}
          >
            Annuler
          </button>
          
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </form>
  );
};