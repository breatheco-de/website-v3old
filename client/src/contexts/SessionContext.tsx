import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Location, UTMParams, WorkerMessage, WorkerResponse } from '@shared/session';
import { defaultSession } from '@shared/session';
import { 
  getCachedSession, 
  saveSession, 
  getNavigatorInfo,
  getDeviceInfo,
  setVisitorIdCookie,
  getVisitorIdFromCookie,
} from '../lib/sessionBootstrap';
import { locations, getLocationBySlug } from '../lib/locations';
import { setSessionHeaders } from '../lib/sessionHeaders';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface SessionContextValue {
  session: Session;
  isLoading: boolean;
  isInitialized: boolean;
  setLocation: (slug: string) => void;
  setLanguage: (lang: 'en' | 'es') => void;
  updateUTM: (utm: Partial<UTMParams>) => void;
  nearestLocations: Location[];
  getLocationsByRegion: (region: Location['region']) => Location[];
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session>(() => {
    const cached = getCachedSession();
    return cached || defaultSession;
  });
  const [isLoading, setIsLoading] = useState(true);
  const workerRef = useRef<Worker | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initWorker = async () => {
      try {
        workerRef.current = new Worker(
          new URL('../workers/session.worker.ts', import.meta.url),
          { type: 'module' }
        );

        workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === 'SESSION_READY') {
            const newSession = event.data.payload;
            setSession(newSession);
            saveSession(newSession);
            if (newSession.visitorId) {
              setVisitorIdCookie(newSession.visitorId);
            }
            setIsLoading(false);
          }
        };

        workerRef.current.onerror = (error) => {
          console.error('Session worker error:', error);
          setIsLoading(false);
        };

        const message: WorkerMessage = {
          type: 'INIT_SESSION',
          payload: {
            cachedSession: getCachedSession(),
            path: window.location.pathname,
            search: window.location.search,
            navigator: getNavigatorInfo(),
            device: getDeviceInfo(),
            existingVisitorId: getVisitorIdFromCookie() ?? undefined,
          },
        };

        workerRef.current.postMessage(message);
      } catch (error) {
        console.error('Failed to initialize session worker:', error);
        setIsLoading(false);
      }
    };

    initWorker();

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const setLocation = useCallback((slug: string) => {
    const location = getLocationBySlug(slug);
    if (location) {
      setSession(prev => {
        const updated = { 
          ...prev, 
          location: { ...location, reliable: true },
          timestamp: Date.now()
        };
        saveSession(updated);
        return updated;
      });
    }
  }, []);

  const setLanguage = useCallback((lang: 'en' | 'es') => {
    setSession(prev => {
      const updated = { ...prev, language: lang, timestamp: Date.now() };
      saveSession(updated);
      return updated;
    });
  }, []);

  const updateUTM = useCallback((utm: Partial<UTMParams>) => {
    setSession(prev => {
      const updated = { 
        ...prev, 
        utm: { ...prev.utm, ...utm },
        timestamp: Date.now()
      };
      saveSession(updated);
      return updated;
    });
  }, []);

  const nearestLocations = locations
    .filter(loc => loc.visibility === 'listed' && loc.slug !== 'online')
    .sort((a, b) => {
      if (!session.geo?.latitude || !session.geo?.longitude) return 0;
      
      const distA = haversineDistance(
        session.geo.latitude, 
        session.geo.longitude, 
        a.latitude, 
        a.longitude
      );
      const distB = haversineDistance(
        session.geo.latitude, 
        session.geo.longitude, 
        b.latitude, 
        b.longitude
      );
      return distA - distB;
    });

  const getLocationsByRegion = useCallback((region: Location['region']) => {
    return locations.filter(loc => loc.region === region && loc.visibility === 'listed');
  }, []);

  useEffect(() => {
    setSessionHeaders(
      session.location?.slug,
      session.location?.region,
      session.language,
      session.visitorId
    );
  }, [session.location?.slug, session.location?.region, session.language, session.visitorId]);

  const value: SessionContextValue = {
    session,
    isLoading,
    isInitialized: session.initialized,
    setLocation,
    setLanguage,
    updateUTM,
    nearestLocations,
    getLocationsByRegion,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

export function useLocation(): Location | null {
  const { session } = useSession();
  return session.location;
}

export function useLanguage(): 'en' | 'es' {
  const { session } = useSession();
  return session.language;
}

export function useUTM(): UTMParams {
  const { session } = useSession();
  return session.utm;
}

export function useRegion(): Location['region'] | null {
  const { session } = useSession();
  return session.location?.region || null;
}
