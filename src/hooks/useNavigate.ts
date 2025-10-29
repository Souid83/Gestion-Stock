/**
 * useNavigate Hook
 * Custom hook for navigation
 */

import { useNavigate as useRouterNavigate } from 'react-router-dom';

export function useNavigate() {
  const navigate = useRouterNavigate();

  console.log('[useNavigate] Hook initialized');

  return navigate;
}

export default useNavigate;
