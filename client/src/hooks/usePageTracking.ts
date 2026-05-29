import { useEffect } from "react";
import { useLocation } from "wouter";

type DataLayerEvent = {
  event: string;
  pagePath?: string;
  pageTitle?: string;
  [key: string]: unknown;
};

export function usePageTracking() {
  const [location] = useLocation();

  useEffect(() => {
    const dataLayer = (window as unknown as { dataLayer: DataLayerEvent[] }).dataLayer || [];
    (window as unknown as { dataLayer: DataLayerEvent[] }).dataLayer = dataLayer;
    
    dataLayer.push({
      event: "website-route-change",
      pagePath: location,
      pageTitle: document.title,
    });
  }, [location]);
}
