import { ReactNode, useLayoutEffect } from 'react';
import { useLocation, type Location } from 'react-router-dom';
import {
  PAGE_TRANSITION_LAYER_CONTEXT_VALUES,
  PageTransitionLayerContext
} from './PageTransitionLayer';
import './PageTransition.scss';

interface PageTransitionProps {
  render: (location: Location) => ReactNode;
  getRouteOrder?: (pathname: string) => number | null;
  getTransitionVariant?: (fromPathname: string, toPathname: string) => 'vertical' | 'ios';
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

const getLayerKey = (location: Location) =>
  `${location.pathname}${location.search}${location.hash}`;

export function PageTransition({ render, scrollContainerRef }: PageTransitionProps) {
  const location = useLocation();
  const layerKey = getLayerKey(location);

  useLayoutEffect(() => {
    const scrollContainer =
      scrollContainerRef?.current ?? (document.scrollingElement as HTMLElement | null);
    scrollContainer?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [layerKey, scrollContainerRef]);

  return (
    <div className="page-transition">
      <div key={layerKey} className="page-transition__layer">
        <PageTransitionLayerContext.Provider
          value={PAGE_TRANSITION_LAYER_CONTEXT_VALUES.current}
        >
          {render(location)}
        </PageTransitionLayerContext.Provider>
      </div>
    </div>
  );
}
