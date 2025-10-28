import React, { useState, useEffect } from 'react';
import { CustomerList } from '../components/Customers/CustomerList';
import { CustomerForm } from '../components/Customers/CustomerForm';
import { CustomerDetail } from '../components/Customers/CustomerDetail';

export const Customers: React.FC = () => {
  const [view, setView] = useState<'list' | 'new' | 'edit' | 'view'>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have a customer ID in session storage
    const editId = sessionStorage.getItem('editCustomerId');
    const viewId = sessionStorage.getItem('viewCustomerId');
    
    if (editId) {
      setSelectedCustomerId(editId);
      setView('edit');
      sessionStorage.removeItem('editCustomerId');
    } else if (viewId) {
      setSelectedCustomerId(viewId);
      setView('view');
      sessionStorage.removeItem('viewCustomerId');
    }
  }, []);

  const handleCustomerSaved = (id: string) => {
    setSelectedCustomerId(id);
    setView('view');
  };

  const renderContent = () => {
    switch (view) {
      case 'new':
        return <CustomerForm onSaved={handleCustomerSaved} />;
      case 'edit':
        return selectedCustomerId ? (
          <CustomerForm 
            customerId={selectedCustomerId} 
            onSaved={handleCustomerSaved} 
          />
        ) : (
          <div>Erreur: ID client manquant</div>
        );
      case 'view':
        return selectedCustomerId ? (
          <CustomerDetail 
            customerId={selectedCustomerId} 
            onBack={() => setView('list')} 
          />
        ) : (
          <div>Erreur: ID client manquant</div>
        );
      case 'list':
      default:
        return (
          <CustomerList
            onNew={() => setView('new')}
            onEdit={(id: string) => {
              setSelectedCustomerId(id);
              setView('edit');
            }}
            onView={(id: string) => {
              setSelectedCustomerId(id);
              setView('view');
            }}
          />
        );
    }
  };

  return (
    <div className="container mx-auto">
      {renderContent()}
    </div>
  );
};
