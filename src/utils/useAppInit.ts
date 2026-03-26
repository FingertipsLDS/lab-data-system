import { useEffect } from 'react';
import { useStore } from '../stores/appStore';

export function useAppInit() {
  const loadAll = useStore(s => s.loadAll);
  const loading = useStore(s => s.loading);
  const loggedIn = useStore(s => s.loggedIn);

  useEffect(() => {
    if (loggedIn) {
      loadAll();
    }
  }, [loggedIn, loadAll]);

  return { loading: loggedIn ? loading : false };
}
