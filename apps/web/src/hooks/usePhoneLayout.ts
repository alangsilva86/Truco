import { useEffect, useState } from 'react';

interface ViewportState {
  width: number;
  height: number;
}

function readViewport(): ViewportState {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function usePhoneLayout() {
  const [viewport, setViewport] = useState<ViewportState>(() => readViewport());

  useEffect(() => {
    function handleResize() {
      setViewport(readViewport());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPortrait = viewport.height >= viewport.width;
  const isPhoneLayout =
    (isPortrait && viewport.width <= 480) ||
    (!isPortrait && viewport.height <= 500);

  return {
    isCompactContext: viewport.width <= 360 || viewport.height <= 700,
    isLandscapePhone: !isPortrait && viewport.height <= 500,
    isPhoneLayout,
    viewport,
  };
}
