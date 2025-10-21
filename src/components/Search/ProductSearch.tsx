import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';

interface SearchProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export const ProductSearch: React.FC<SearchProps> = ({ onSearch, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // Check if we should focus the search input
    const shouldFocus = sessionStorage.getItem('shouldFocusSearch');
    if (shouldFocus === 'true' && inputRef.current) {
      inputRef.current.focus();
      sessionStorage.removeItem('shouldFocusSearch');
    }

    // Listen for search updates from the sidebar SearchBar
    const handleStorageChange = () => {
      const newQuery = sessionStorage.getItem('productSearchQuery');
      if (newQuery !== null) {
        setQuery(newQuery);
        onSearch(newQuery);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [onSearch]);

  const handleSearch = (value: string) => {
    console.log('handleSearch called with value:', value);
    setQuery(value);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer (300ms)
    debounceTimerRef.current = setTimeout(() => {
      console.log('Debounced search executing for:', value);
      onSearch(value);
    }, 300);
  };

  const handleSearchClick = () => {
    onSearch(query);
  };

  const clearSearch = () => {
    console.log('clearSearch called');
    setQuery('');

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    onSearch('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom, SKU, EAN..."
          className="w-full bg-[#24303a] text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        <button
          onClick={handleSearchClick}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
        >
          <SearchIcon size={18} />
        </button>
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};