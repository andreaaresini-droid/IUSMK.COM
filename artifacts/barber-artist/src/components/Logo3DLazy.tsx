// Logo3DLazy — carica la libreria 3D (three.js, ~1 MB) solo DOPO che il sito
// è già visibile. Mentre arriva, mostra il logo piatto nello stesso spazio,
// così la pagina non salta. Non importare "three" in questo file.
import { lazy, Suspense } from "react";
import type { ComponentProps, CSSProperties } from "react";
import type { Logo3D as Logo3DReal } from "./Logo3D";

const Logo3DImpl = lazy(() => import("./Logo3D").then((m) => ({ default: m.Logo3D })));

type Props = ComponentProps<typeof Logo3DReal>;

// Stesse misure di VARIANTS in Logo3D.tsx
const SIZE: Record<NonNullable<Props["variant"]>, CSSProperties> = {
  intro:  { width: "100%", height: "100%" },
  hero:   { width: "clamp(320px, min(58vw, 52vh), 540px)", height: "clamp(320px, min(58vw, 52vh), 540px)" },
  header: { width: "clamp(105px, 15vw, 140px)", height: "70px" },
};

export function Logo3D(props: Props) {
  const variant = props.variant ?? "intro";
  const placeholder = (
    <div
      style={{
        ...SIZE[variant],
        ...props.style,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: variant === "header" ? "flex-start" : "center",
        pointerEvents: "none",
      }}
    >
      {props.fallback}
    </div>
  );
  return (
    <Suspense fallback={placeholder}>
      <Logo3DImpl {...props} />
    </Suspense>
  );
}
