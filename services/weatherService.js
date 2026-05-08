const WMO = {
  0:  { emoji: '☀️',  desc: 'Despejado' },
  1:  { emoji: '🌤️', desc: 'Mayormente despejado' },
  2:  { emoji: '⛅',  desc: 'Parcialmente nublado' },
  3:  { emoji: '☁️',  desc: 'Nublado' },
  45: { emoji: '🌫️', desc: 'Niebla' },
  48: { emoji: '🌫️', desc: 'Niebla con escarcha' },
  51: { emoji: '🌦️', desc: 'Llovizna ligera' },
  53: { emoji: '🌦️', desc: 'Llovizna moderada' },
  55: { emoji: '🌧️', desc: 'Llovizna intensa' },
  61: { emoji: '🌧️', desc: 'Lluvia ligera' },
  63: { emoji: '🌧️', desc: 'Lluvia moderada' },
  65: { emoji: '🌧️', desc: 'Lluvia intensa' },
  71: { emoji: '❄️',  desc: 'Nieve ligera' },
  73: { emoji: '❄️',  desc: 'Nieve moderada' },
  75: { emoji: '❄️',  desc: 'Nevada fuerte' },
  80: { emoji: '🌧️', desc: 'Chubascos ligeros' },
  81: { emoji: '🌧️', desc: 'Chubascos moderados' },
  82: { emoji: '⛈️',  desc: 'Chubascos fuertes' },
  95: { emoji: '⛈️',  desc: 'Tormenta' },
  96: { emoji: '⛈️',  desc: 'Tormenta con granizo' },
  99: { emoji: '⛈️',  desc: 'Tormenta fuerte' },
};

const toDateStr = (date) => date.toISOString().split('T')[0];

export const weatherService = {
  async getForecast(lat, lon, fechaISO) {
    try {
      const fiestaDate = new Date(fechaISO);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((fiestaDate - today) / (1000 * 60 * 60 * 24));

      // Open-Meteo only provides 16-day forecast
      if (diffDays < 0 || diffDays > 15) return null;

      const dateStr = toDateStr(fiestaDate);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&start_date=${dateStr}&end_date=${dateStr}&timezone=Europe%2FMadrid`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.daily?.weathercode?.length) return null;

      const code = data.daily.weathercode[0];
      const wmo = WMO[code] ?? { emoji: '🌡️', desc: 'Variable' };

      return {
        emoji: wmo.emoji,
        desc: wmo.desc,
        maxTemp: Math.round(data.daily.temperature_2m_max[0]),
        minTemp: Math.round(data.daily.temperature_2m_min[0]),
        precipitation: Math.round(data.daily.precipitation_sum[0] * 10) / 10,
      };
    } catch (e) {
      console.warn('Error meteorología:', e);
      return null;
    }
  },
};
