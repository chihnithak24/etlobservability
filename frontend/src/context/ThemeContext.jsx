import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = [
  { id: 'soft-light', label: 'Soft Light', icon: 'Feather', desc: 'Single Soft Light theme with plum accents' },
];

export function ThemeProvider({ children }) {
  const [theme] = useState('soft-light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'soft-light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: () => {}, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}


