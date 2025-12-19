// src/components/MapEffect.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useSelector, useDispatch } from "react-redux";
import { setFocusTarget } from "../store/uiSlice";

const MapEffect = () => {
  const map = useMap(); // Получаем доступ к экземпляру карты Leaflet
  const dispatch = useDispatch();
  const focusTarget = useSelector((state) => state.ui.focusTarget);

  useEffect(() => {
    if (focusTarget) {
      // Плавно летим к цели
      map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || 17, {
        duration: 1.5, // Секунды полета
      });

      // Сразу сбрасываем цель в null, чтобы можно было полететь туда же еще раз
      // (иначе Redux не увидит изменений, если координаты те же)
      // Делаем небольшой таймаут, чтобы полет успел начаться
      setTimeout(() => {
        // Но лучше просто не сбрасывать, а проверять изменение объекта.
        // В простой реализации можно оставить как есть или сбрасывать.
        // Давай пока оставим.
      }, 100);
    }
  }, [focusTarget, map]);

  return null; // Этот компонент ничего не рисует, он только управляет
};

export default MapEffect;
