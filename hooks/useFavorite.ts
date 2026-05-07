import { useEffect, useState } from 'react';
import { favoritesService } from '../services/favoritesService';

/**
 * Hook personalizado para manejar favoritos
 * @param fiestaId - ID de la fiesta
 * @returns { isFavorite, toggleFavorite, loading }
 */
export const useFavorite = (fiestaId: string) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFavorite = async () => {
      try {
        const favorite = await favoritesService.isFavorite(fiestaId);
        setIsFavorite(favorite);
      } catch (error) {
        console.error('Error verificando favorito:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFavorite();
  }, [fiestaId]);

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await favoritesService.removeFavorite(fiestaId);
        setIsFavorite(false);
      } else {
        await favoritesService.addFavorite(fiestaId);
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorito:', error);
    }
  };

  return { isFavorite, toggleFavorite, loading };
};
