// ─────────────────────────────────────────────────────────────────────────────
// Logo3D — varianti: "intro" | "hero" | "header"
//
// Pivot fix (tutte le varianti):
//   1. Clone la scena GLB
//   2. Calcola il bounding box reale con updateMatrixWorld
//   3. Sottrae il centro → geometria centrata a (0,0,0)
//   4. La scala è applicata su un group padre → rotazione intorno al centro
//
// Variante "header":
//   • Usa logo-3d-nero.glb
//   • Solo auto-rotazione (nessun OrbitControls)
//   • pointer-events: none → link/click passano attraverso il canvas
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, Component, useRef, useCallback, useMemo } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Sorgenti GLB ──────────────────────────────────────────────────────────────
const MODEL_SRC        = `${import.meta.env.BASE_URL}logo-3d.glb`;
const HEADER_LOGO_SRC  = `${import.meta.env.BASE_URL}logo-3d-nero.glb`;

useGLTF.preload(MODEL_SRC);
useGLTF.preload(HEADER_LOGO_SRC);

// ── WebGL check ───────────────────────────────────────────────────────────────
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch { return false; }
}

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { hasError: boolean }
class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  EBState
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) {}
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── Mesh con pivot corretto ───────────────────────────────────────────────────
// Carica il GLB dalla src indicata, centra la geometria a (0,0,0).
// La scala NON è applicata qui — va sul group padre per non rompere il pivot.
function LogoMesh({ src }: { src: string }) {
  const { scene } = useGLTF(src);

  const cloned = useMemo(() => {
    const c = scene.clone(true);

    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow    = false;
        mesh.receiveShadow = false;
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: "#ffffff", roughness: 0.25, metalness: 0.45,
          });
        }
      }
    });

    // Pivot fix: centra la bbox del modello su (0,0,0)
    c.updateMatrixWorld(true);
    const box    = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    c.position.sub(center);

    return c;
  }, [scene]);

  return <primitive object={cloned} />;
}

// ── Scena con auto-rotazione + interazione (intro / hero) ─────────────────────
function AutoRotatingScene({
  modelScale,
  src,
}: {
  modelScale: number;
  src: string;
}) {
  const groupRef         = useRef<THREE.Group>(null);
  const isInteractingRef = useRef(false);
  const resumeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ~0.38 rad/s → 1 giro ogni ≈16 secondi
  useFrame((_state, delta) => {
    if (groupRef.current && !isInteractingRef.current) {
      groupRef.current.rotation.y += delta * 0.38;
    }
  });

  const handleStart = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isInteractingRef.current = true;
  }, []);

  const handleEnd = useCallback(() => {
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 1000);
  }, []);

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 5, 6]}   intensity={2.0} />
      <directionalLight position={[-3, -2, -3]} intensity={0.6} color="#ffffff" />
      <pointLight       position={[0, 0, 4]}    intensity={0.7} color="#FFD600" />

      <group ref={groupRef} scale={modelScale}>
        <Suspense fallback={null}>
          <LogoMesh src={src} />
        </Suspense>
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        target={[0, 0, 0]}
        onStart={handleStart}
        onEnd={handleEnd}
      />
    </>
  );
}

// ── Scena solo auto-rotazione, nessuna interazione (header) ───────────────────
function HeaderAutoRotatingScene({
  modelScale,
  src,
}: {
  modelScale: number;
  src: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Stessa velocità: ~0.38 rad/s ≈ 1 giro ogni 16 secondi
  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.38;
    }
  });

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[3, 4, 5]}  intensity={2.2} />
      <directionalLight position={[-2, -1, -2]} intensity={0.5} color="#ffffff" />

      <group ref={groupRef} scale={modelScale}>
        <Suspense fallback={null}>
          <LogoMesh src={src} />
        </Suspense>
      </group>

      {/* Nessun OrbitControls → il logo non è interattivo */}
    </>
  );
}

// ── Scena intro: rotazione continua → accelerazione + scala al tap ────────────
// La rotazione Y è SEMPRE gestita qui (mai da Framer Motion) per evitare salti.
// Quando animating=true la velocità cresce progressivamente e chiama onDone.
const INTRO_BASE_SPEED = 0.72;   // rad/s a riposo (aumentato per rotazione di base più visibile)
const INTRO_ANIM_S     = 2.8;    // durata accelerazione in secondi

function IntroRotatingScene({
  modelScale,
  src,
  animating,
  onDone,
}: {
  modelScale:  number;
  src:         string;
  animating:   boolean;
  onDone?:     () => void;
}) {
  const groupRef   = useRef<THREE.Group>(null);
  const timeRef    = useRef(0);
  const doneRef    = useRef(false);
  const animRef    = useRef(false);  // traccia il valore corrente senza re-render

  // Sincronizza il ref con la prop (evita closure stale in useFrame)
  animRef.current = animating;

  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    if (animRef.current) {
      timeRef.current += delta;
      const t      = Math.min(timeRef.current / INTRO_ANIM_S, 1);
      // easeIn quartic → lenta partenza, poi esplosiva
      const eased  = t * t * t * t;
      const speed  = INTRO_BASE_SPEED * (1 + eased * 75);   // 1× → 76× (molto più aggressivo)
      groupRef.current.rotation.y += delta * speed;

      if (t >= 1 && !doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    } else {
      // Riposo: velocità base, reset timer
      timeRef.current = 0;
      doneRef.current = false;
      groupRef.current.rotation.y += delta * INTRO_BASE_SPEED;
    }
  });

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[3, 4, 5]}   intensity={2.2} />
      <directionalLight position={[-2, -1, -2]} intensity={0.5} color="#ffffff" />
      <pointLight       position={[0, 0, 4]}    intensity={0.7} color="#FFD600" />

      <group ref={groupRef} scale={modelScale}>
        <Suspense fallback={null}>
          <LogoMesh src={src} />
        </Suspense>
      </group>
    </>
  );
}

// ── Varianti ─────────────────────────────────────────────────────────────────
// Canvas QUADRATO con min(Xvw, Xvh) → nessun clipping durante la rotazione.
const VARIANTS = {
  intro: {
    src:        MODEL_SRC,
    // Canvas fills its container — il box coincide con il gate, invisibile
    width:      "100%",
    height:     "100%",
    modelScale: 0.28,   // più piccolo così il logo non occupa lo schermo intero
    camZ:       5.5,
    fov:        34,
    interactive: false, // nessun OrbitControls → click passano al gate
  },
  hero: {
    src:        MODEL_SRC,
    width:      "clamp(320px, min(58vw, 52vh), 540px)",
    height:     "clamp(320px, min(58vw, 52vh), 540px)",
    modelScale: 0.72,
    camZ:       5.5,
    fov:        35,
    interactive: true,
  },
  header: {
    src:        HEADER_LOGO_SRC,
    // Dimensioni che replicano il vecchio logo 2D (h-9 ≈ 36px alto, ~100px largo).
    // clamp(85px, 12vw, 115px): mobile≈85px, desktop≈115px.
    // Altezza fissa 56px — leggermente più del 36px originale per dare
    // respiro al modello 3D senza occupare più spazio nell'header.
    // overflow:visible sul div → nessun crop durante la rotazione Y.
    width:       "clamp(105px, 15vw, 140px)",
    height:      "70px",
    modelScale:  0.70,
    camZ:        4.5,
    fov:         30,
    interactive: false,
  },
} as const;

// ── Componente pubblico ───────────────────────────────────────────────────────
interface Logo3DProps {
  variant?:       "intro" | "hero" | "header";
  fallback?:      ReactNode;
  style?:         React.CSSProperties;
  /** Solo variante intro: true = avvia accelerazione/esplosione */
  animating?:     boolean;
  /** Solo variante intro: chiamato quando l'animazione esplosione è finita */
  onAnimComplete?: () => void;
}

export function Logo3D({
  variant = "intro",
  fallback = null,
  style,
  animating = false,
  onAnimComplete,
}: Logo3DProps) {
  if (!hasWebGL()) return <>{fallback}</>;

  const v = VARIANTS[variant];

  const canvas3d = (
    <div
      style={{
        width:         v.width,
        height:        v.height,
        position:      "relative",
        overflow:      "visible",
        pointerEvents: v.interactive ? "auto" : "none",
        ...style,
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        camera={{ position: [0, 0, v.camZ], fov: v.fov, near: 0.1, far: 100 }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0);
          scene.background = null;
        }}
        style={{
          width:      "100%",
          height:     "100%",
          background: "transparent",
        }}
      >
        {variant === "intro" ? (
          // Scena intro dedicata: gestisce rotazione continua + accelerazione
          <IntroRotatingScene
            modelScale={v.modelScale}
            src={v.src}
            animating={animating}
            onDone={onAnimComplete}
          />
        ) : v.interactive ? (
          <AutoRotatingScene modelScale={v.modelScale} src={v.src} />
        ) : (
          <HeaderAutoRotatingScene modelScale={v.modelScale} src={v.src} />
        )}
      </Canvas>
    </div>
  );

  return (
    <WebGLErrorBoundary fallback={fallback}>
      {canvas3d}
    </WebGLErrorBoundary>
  );
}
