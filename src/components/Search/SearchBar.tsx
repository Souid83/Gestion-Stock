import React, { useState, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useNavigate } from '../../hooks/useNavigate';

export const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigateToProduct } = useNavigate();

  const performSearch = () => {
    if (query.trim().length >= 2) {
      setIsSearching(true);
      
      // Store the search query
      sessionStorage.setItem('productSearchQuery', query.trim());
      sessionStorage.setItem('shouldFocusSearch', 'true');
      sessionStorage.setItem('shouldTriggerSearch', 'true');
      
      // Navigate to product list
      navigateToProduct('product-list');
      
      // Clear the search input
      setQuery('');
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsSearching(false);

    // If we're already on the products page, update the search query directly
    const currentPage = (window as any).__getCurrentPage?.();
    if (currentPage === 'product-list') {
      sessionStorage.setItem('productSearchQuery', newQuery);
      // Trigger a storage event to notify the ProductSearch component
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleClear = () => {
    setQuery('');
    setIsSearching(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <div className="relative flex">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un produit..."
          className={`w-full bg-[#24303a] text-white rounded-l-lg pl-3 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isSearching ? 'ring-2 ring-blue-500' : ''
          }`}
          autoComplete="off"
        />
        <button
          onClick={handleSearchClick}
          className="bg-[#24303a] text-gray-400 hover:text-white px-3 rounded-r-lg border-l border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <SearchIcon size={18} />
        </button>
      </div>

      {query && (
        <button
          onClick={handleClear}
          className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};