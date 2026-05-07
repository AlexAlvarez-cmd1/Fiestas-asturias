import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }) => {
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState('light');
  const [primaryColor, setPrimaryColor] = useState('#166534');
  const [emojiFiesta, setEmojiFiesta] = useState('⛺');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedUsername = await storageService.getItem('config_username');
        const storedTheme = await storageService.getItem('config_theme');
        const storedColor = await storageService.getItem('config_primaryColor');
        const storedEmoji = await storageService.getItem('config_emojiFiesta');

        if (storedUsername) setUsername(storedUsername);
        if (storedTheme) setTheme(storedTheme);
        if (storedColor) setPrimaryColor(storedColor);
        if (storedEmoji) setEmojiFiesta(storedEmoji);
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveConfig = async (key, value, setter) => {
    setter(value);
    await storageService.setItem(key, value);
  };

  if (loading) return null; // or a loader if necessary

  return (
    <ConfigContext.Provider
      value={{
        username,
        setUsername: (val) => saveConfig('config_username', val, setUsername),
        theme,
        setTheme: (val) => saveConfig('config_theme', val, setTheme),
        primaryColor,
        setPrimaryColor: (val) => saveConfig('config_primaryColor', val, setPrimaryColor),
        emojiFiesta,
        setEmojiFiesta: (val) => saveConfig('config_emojiFiesta', val, setEmojiFiesta),
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};