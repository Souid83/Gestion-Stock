import { useCallback } from 'react';

export const useNavigate = () => {
  const navigateToProduct = useCallback((page: string) => {
    // Get the setCurrentPage function
    const setCurrentPage = (window as any).__setCurrentPage;
    if (setCurrentPage) {
      setCurrentPage(page);
    }
  }, []);

  return { navigateToProduct };
};