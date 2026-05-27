import { useState, useCallback, ImgHTMLAttributes } from "react";
import { ImageIcon } from "lucide-react";

interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

/**
 * Un tag <img> con:
 * - Shimmer leggero durante il caricamento (sovrapposto via opacity)
 * - Fade-in dell'immagine a caricamento completato
 * - Retry automatico una volta con cache-busting per URL API (/api/...)
 * - Fallback elegante in caso di errore definitivo
 * - Log in console a ogni step
 *
 * Il componente NON aggiunge wrapper extra: usa solo la transizione opacity
 * sull'img e il background del container come shimmer naturale.
 */
export function ResilientImage({
  src,
  alt,
  className,
  fallbackClassName,
  onError: outerOnError,
  onLoad: outerOnLoad,
  style,
  ...rest
}: ResilientImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [retried, setRetried] = useState(false);
  const [retrySrc, setRetrySrc] = useState<string | undefined>(undefined);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setStatus("loaded");
      outerOnLoad?.(e);
    },
    [outerOnLoad],
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const currentSrc = (e.target as HTMLImageElement).src;

      if (!retried && src && (src.startsWith("/api/") || src.startsWith("./api/"))) {
        console.warn(`[ResilientImage] Caricamento fallito, riprovo: ${src}`);
        setRetried(true);
        const sep = src.includes("?") ? "&" : "?";
        setRetrySrc(`${src}${sep}_retry=${Date.now()}`);
        return;
      }

      console.error(`[ResilientImage] Immagine non disponibile: ${src ?? currentSrc}`);
      setStatus("failed");
      outerOnError?.(e);
    },
    [src, retried, outerOnError],
  );

  if (status === "failed") {
    return (
      <div
        className={
          fallbackClassName ??
          `${className ?? ""} flex items-center justify-center bg-white/5`
        }
        style={style}
        aria-label={alt}
        title={alt}
      >
        <ImageIcon className="w-5 h-5 text-white/20" />
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={retrySrc ?? src}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: status === "loaded" ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
