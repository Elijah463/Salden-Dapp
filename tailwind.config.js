/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        salden: {
          bg: "#060B18",
          surface: "#0D1728",
          card: "#111827",
          border: "#1E2D4A",
          hover: "#172035",
          "text-primary": "#F8FAFC",
          "text-secondary": "#94A3B8",
          "text-muted": "#475569",
          blue: "#3B82F6",
          "blue-dark": "#2563EB",
          "blue-light": "#60A5FA",
          violet: "#8B5CF6",
          "violet-dark": "#7C3AED",
          success: "#10B981",
          error: "#EF4444",
          warning: "#F59E0B",
          "glow-green": "#00FF87",
          "glow-red": "#FF3B3B",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "glow-green": "glowGreen 2s ease-in-out infinite alternate",
        "glow-red": "glowRed 2s ease-in-out infinite alternate",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "gradient-x": "gradientX 8s ease infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        glowGreen: {
          "0%": { boxShadow: "0 0 5px #00FF87, 0 0 10px #00FF87" },
          "100%": { boxShadow: "0 0 20px #00FF87, 0 0 40px #00FF87" },
        },
        glowRed: {
          "0%": { boxShadow: "0 0 5px #FF3B3B, 0 0 10px #FF3B3B" },
          "100%": { boxShadow: "0 0 20px #FF3B3B, 0 0 40px #FF3B3B" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      backgroundSize: {
        "300%": "300%",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
