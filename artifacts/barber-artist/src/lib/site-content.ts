const BASE = import.meta.env.BASE_URL;

export const SITE_CONTENT = {
  artist: {
    photo: `${BASE}images/iusmk-portrait.webp`,
    photoAlt: "Giuseppe Musto — IUSMK, Barber Artist",
    aboutBanner: `${BASE}images/iusmk-portrait.webp`,
    aboutBannerAlt: "Giuseppe Musto — IUSMK",
  },

  home: {
    artistSection: {
      eyebrow: "Chi è IUSMK?",
      title: "GIUSEPPE MUSTO,\nBARBER ARTIST.",
      description:
        "Sono Giuseppe Musto, in arte IUSMK. Mi definisco un barber artist, un ricercatore instancabile di linee, forme e colori. Vivo ogni giorno immerso nell'universo dei capelli: dal dettaglio più tecnico allo stile che racconta chi sei, dal gesto quotidiano al tratto artistico che lascia il segno.",
    },
  },

  about: {
    headline: "Chi è\nIUSMK?",
  },
} as const;
