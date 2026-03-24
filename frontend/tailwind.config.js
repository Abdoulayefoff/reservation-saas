/** @type {import('tailwindcss').Config} */
export default {
  // Définit où Tailwind doit chercher les classes CSS à générer
  content: [
    "./index.html", // Fichier racine HTML
    "./src/**/*.{js,ts,jsx,tsx}", // Tout fichier TS/JS dans src
  ],
  
  // THÉMATISATION (DESIGN SYSTEM)
  theme: {
    extend: { // Étend le thème par défaut de Tailwind sans l'écraser
      
      // Palette de couleurs personnalisée
      colors: {
        noir: { // Nuancier de tons neutres / sombres inversés (Style light ambre)
          950: '#F7F3EE',  /* Couleur fond page — Ivoire chaud */
          900: '#F2EDE5',  /* Sous-fond secondaire */
          850: '#FFFFFF',  /* Surfaces blanches pures */
          800: '#FBF8F4',  /* Fond de carte (Card background) */
          750: '#F5EFE8',  /* Variante carte alternative */
          700: '#E8DFD2',  /* Bordures douces */
          650: '#DDD3C4',  /* Bordures standard */
          600: '#CDBFA8',  /* Bordures renforcées */
          500: '#B0A090',  /* Éléments muets/faibles */
          400: '#8C7D6E',  /* Texte estompé */
          300: '#6B5E50',  /* Texte secondaire atténué */
          200: '#4A3E35',  /* Texte secondaire contrasté */
          100: '#2A1F18',  /* Corps de texte principal (Texte lu) */
          50:  '#140C07',  /* Texte le plus sombre / titres */
        },
        sol: { // Nuancier Ambre / "Soleil" pour l'identité visuelle
          DEFAULT: '#E8A730', // Couleur principale primaire
          50:  '#FFF8E7',
          100: '#FEEFC4',
          200: '#FDDF89',
          300: '#F8CC55',
          400: '#F2BA32',
          500: '#E8A730',
          600: '#CC8D1E',
          700: '#A87115',
          800: '#865810',
          900: '#6B460D',
          950: '#432806',
        },
      },

      // Polices d'écritures
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'], // Pour les titres (Effet premium)
        sans:    ['Syne', 'system-ui', 'sans-serif'], // Texte courant / Boutons
        mono:    ['"DM Mono"', 'Menlo', 'monospace'], // Numéros / Badges / Codes
      },

      // Déclarations d'animations CSS (Triggers)
      animation: {
        'fade-up':    'fadeUp 0.55s ease-out both', // Apparition du bas vers le haut
        'fade-in':    'fadeIn 0.4s ease-out both', // Fondu d'apparition simple
        'slide-down': 'slideDown 0.3s ease-out both', // Glissement vers le bas
        'marquee':    'marquee 35s linear infinite', // Défilement continu (Ticker)
        'glow-pulse': 'glowPulse 3s ease-in-out infinite', // Battement de lueur
      },

      // Définitions des étapes d'animations (Keyframes)
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' }, // Se décale de moitié
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 16px rgba(232,167,48,0.1)' },
          '50%':      { boxShadow: '0 0 32px rgba(232,167,48,0.25)' },
        },
      },
    },
  },
  plugins: [], // Plugins tailwind (facultatifs)
}
