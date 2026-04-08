/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8F0',
        'warm-dark': '#2D2A26',
        'warm-muted': '#8B8680',
        terracotta: '#E07A5F',
        sage: '#81B29A',
        sand: '#F2CC8F',
        navy: '#3D405B',
        'warm-border': '#E8E0D8',
      },
      fontFamily: {
        display: ['"LXGW WenKai"', '"Noto Serif SC"', 'serif'],
        body: ['"LXGW WenKai"', '"Noto Sans SC"', 'sans-serif'],
        western: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: {
        soft: '16px',
        card: '20px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(45, 42, 38, 0.06)',
        float: '0 8px 30px rgba(45, 42, 38, 0.12)',
      },
    },
  },
  plugins: [],
};
