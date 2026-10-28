import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'white',
  toggleTheme: () => {},
  setTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('anon_theme');
      if (saved === 'white' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'white';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('anon_theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  function setTheme(newTheme) {
    if (newTheme === 'white' || newTheme === 'dark') {
      setThemeState(newTheme);
    }
  }

  function toggleTheme() {
    setThemeState(prev => (prev === 'white' ? 'dark' : 'white'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
