// src/components/MapComponent.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// OpenLayers Imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { OSM, XYZ } from 'ol/source';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style, Icon } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Translate } from 'ol/interaction';
import { defaults as defaultInteractions } from 'ol/interaction';

// Redux Actions
import { addNode, moveNode, addPipe } from '../store/networkSlice';
import { selectNode, setEditingElement, resetSelection, setFocusTarget } from '../store/uiSlice';

const MapComponent = () => {
  const dispatch = useDispatch();
  
  // Данные из Redux
  const { nodes, pipes, currentProjectId } = useSelector((state) => state.network);
  const { mode, selectedNodeId, focusTarget } = useSelector((state) => state.ui);

  // Ссылки на объекты карты (чтобы они жили между рендерами)
  const mapElement = useRef();      // DIV элемент
  const mapRef = useRef();          // Сама карта OL
  const nodesSource = useRef(new VectorSource());
  const pipesSource = useRef(new VectorSource());
  
  // Локальное состояние для переключения слоев
  const [activeLayer, setActiveLayer] = useState('osm'); 

  // =========================================================
  // 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ (Один раз при старте)
  // =========================================================
  useEffect(() => {
    // Слои
    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: true,
      properties: { name: 'osm' }
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri'
      }),
      visible: false,
      properties: { name: 'satellite' }
    });

    const darkLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attributions: '© OpenStreetMap, © CARTO'
      }),
      visible: false,
      properties: { name: 'dark' }
    });

    // Векторные слои (Трубы и Узлы)
    const pipesLayer = new VectorLayer({
      source: pipesSource.current,
      style: pipeStyleFunction, // Функция стилизации ниже
      zIndex: 1
    });

    const nodesLayer = new VectorLayer({
      source: nodesSource.current,
      style: nodeStyleFunction, // Функция стилизации ниже
      zIndex: 2
    });

    // Создаем карту
    const map = new Map({
      target: mapElement.current,
      layers: [osmLayer, satelliteLayer, darkLayer, pipesLayer, nodesLayer],
      view: new View({
        center: fromLonLat([37.57, 55.75]), // Москва [Lon, Lat]
        zoom: 13
      }),
      controls: [], // Убираем стандартные кнопки зума (если нужно, можно оставить)
    });

    mapRef.current = map;

    // --- ОБРАБОТЧИКИ СОБЫТИЙ (КЛИКИ) ---
    map.on('click', handleMapClick);

    // Курсор pointer при наведении на объекты
    map.on('pointermove', function (e) {
      const pixel = map.getEventPixel(e.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    // Очистка при размонтировании компонента
    return () => {
      map.setTarget(null);
    };
  }, []); // Пустой массив - только 1 раз

  // =========================================================
  // 2. СТИЛИЗАЦИЯ (Цвета труб и узлов)
  // =========================================================
  
  // Стиль для ТРУБ
  const pipeStyleFunction = (feature) => {
    const props = feature.getProperties();
    const velocity = props.calculated_velocity;
    let color = '#808080'; // Серый по умолчанию
    let width = 3;

    if (velocity !== null && velocity !== undefined) {
       if (velocity < 0.5) color = '#00BFFF'; // Голубой
       else if (velocity < 2.0) color = '#0000FF'; // Синий
       else color = '#FF0000'; // Красный
    }

    return new Style({
      stroke: new Stroke({
        color: color,
        width: width
      })
    });
  };

  // Стиль для УЗЛОВ
  const nodeStyleFunction = (feature) => {
    const props = feature.getProperties();
    const type = props.node_type;
    const isSelected = props.selected; // Мы будем ставить этот флаг вручную

    const color = type === 'Reservoir' ? 'red' : 'green';
    const finalColor = isSelected ? 'yellow' : color;

    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: finalColor }),
        stroke: new Stroke({ color: 'white', width: 2 })
      })
    });
  };

  // =========================================================
  // 3. ОБНОВЛЕНИЕ ДАННЫХ (React -> OpenLayers)
  // =========================================================
  useEffect(() => {
    if (!mapRef.current) return;

    // Парсер GeoJSON
    const format = new GeoJSON({
      featureProjection: 'EPSG:3857' // Трансформируем из Lat/Lon в проекцию карты
    });

    // Обновляем УЗЛЫ
    nodesSource.current.clear();
    if (nodes.length > 0) {
      const features = format.readFeatures({ type: 'FeatureCollection', features: nodes });
      // Добавляем ID в сами фичи для удобства
      features.forEach(f => {
          // Если этот узел выбран для соединения трубой - пометим его
          if (selectedNodeId && f.getId() === selectedNodeId) {
              f.set('selected', true);
          }
      });
      nodesSource.current.addFeatures(features);
    }

    // Обновляем ТРУБЫ
    pipesSource.current.clear();
    if (pipes.length > 0) {
      const features = format.readFeatures({ type: 'FeatureCollection', features: pipes });
      pipesSource.current.addFeatures(features);
    }

  }, [nodes, pipes, selectedNodeId]); // Перерисовываем, если данные или выбор изменились

  // =========================================================
  // 4. УПРАВЛЕНИЕ СЛОЯМИ
  // =========================================================
  useEffect(() => {
    if (!mapRef.current) return;
    const layers = mapRef.current.getLayers().getArray();
    layers.forEach(layer => {
      // Меняем видимость только у тайловых слоев с именем
      if (layer instanceof TileLayer && layer.get('name')) {
        layer.setVisible(layer.get('name') === activeLayer);
      }
    });
  }, [activeLayer]);

  // =========================================================
  // 5. ИНТЕРАКТИВ (Перемещение / Drag & Drop)
  // =========================================================
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Удаляем старые взаимодействия, чтобы не дублировать
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Translate) map.removeInteraction(interaction);
    });

    // Если режим VIEW - добавляем возможность таскать узлы
    if (mode === 'view') {
      const translate = new Translate({
        layers: [map.getLayers().getArray()[4]] // 4 - это nodesLayer (см. инициализацию)
      });

      translate.on('translateend', (evt) => {
        const feature = evt.features.getArray()[0];
        const geometry = feature.getGeometry();
        const coords = toLonLat(geometry.getCoordinates()); // [Lon, Lat]
        const id = feature.getId();

        if (window.confirm(`Переместить узел ${id}?`)) {
           dispatch(moveNode({ id: id, lat: coords[1], lng: coords[0] }));
        } else {
           // Если отмена - по хорошему надо вернуть обратно, но пока оставим так
           // При следующем обновлении store он вернется сам
        }
      });

      map.addInteraction(translate);
    }
  }, [mode, dispatch]); // Пересоздаем взаимодействие при смене режима

  // =========================================================
  // 6. ОБРАБОТЧИК КЛИКОВ (Логика приложения)
  // =========================================================
  const handleMapClick = (evt) => {
    const map = mapRef.current;
    
    // Проверяем, кликнули ли мы по объекту (узлу или трубе)
    const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);

    // Достаем текущее состояние из замыкания (через Refs нельзя, т.к. режим меняется)
    // В обработчиках OL сложно достать актуальный стейт React. 
    // Используем простой хак: мы не можем использовать `mode` напрямую внутри callback 
    // если он не в useEffect. Но map.on('click') задан один раз.
    // ПРАВИЛЬНЕЕ: Переназначать listener при смене mode. Сделаем проще.
  };

  // ПЕРЕПИСЫВАЕМ ОБРАБОТКУ КЛИКА ЧЕРЕЗ USEEFFECT
  // Чтобы всегда иметь доступ к актуальному `mode` и `currentProjectId`
  useEffect(() => {
      if(!mapRef.current) return;
      const map = mapRef.current;

      const listener = (evt) => {
          const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
          
          // --- ЛОГИКА ДЛЯ РЕЖИМОВ ---

          // 1. ADD NODE (Клик по пустому месту)
          if (mode === 'add_node' && !feature) {
              if(!currentProjectId) return;
              const coords = toLonLat(evt.coordinate); // [Lon, Lat]
              dispatch(addNode({
                  project: currentProjectId,
                  name: `Узел ${Date.now()}`,
                  node_type: 'Junction',
                  elevation: 0,
                  geometry: { type: 'Point', coordinates: coords }
              }));
              return;
          }

          // 2. ADD PIPE (Клик по узлу)
          if (mode === 'add_pipe' && feature) {
              const props = feature.getProperties();
              // Проверяем, что это узел (у труб нет node_type, если только мы не добавим)
              // Или проверяем геометрию
              if (feature.getGeometry().getType() === 'Point') {
                  const nodeId = feature.getId();
                  
                  if (!selectedNodeId) {
                      dispatch(selectNode(nodeId));
                  } else if (selectedNodeId !== nodeId) {
                      // Ищем координаты первого узла
                      const startNode = nodes.find(n => n.id === selectedNodeId);
                      const endCoords = toLonLat(feature.getGeometry().getCoordinates());
                      
                      if (startNode) {
                          dispatch(addPipe({
                              project: currentProjectId,
                              name: `Труба`,
                              from_node: selectedNodeId,
                              to_node: nodeId,
                              length: 100,
                              diameter: 100,
                              roughness_coefficient: 0.1,
                              material: 'Сталь',
                              geometry: {
                                  type: "LineString",
                                  coordinates: [startNode.geometry.coordinates, endCoords]
                              }
                          }));
                          dispatch(resetSelection());
                          alert("Труба создана!");
                      }
                  }
              }
              return;
          }

          // 3. VIEW (Клик для выбора/редактирования)
          if (mode === 'view' && feature) {
              const type = feature.getGeometry().getType() === 'Point' ? 'node' : 'pipe';
              dispatch(setEditingElement({ type: type, id: feature.getId() }));
          }
      };

      map.on('click', listener);

      return () => map.un('click', listener); // Чистим слушатель при изменении зависимостей
  }, [mode, currentProjectId, selectedNodeId, nodes, dispatch]);


  // =========================================================
  // 7. MAP EFFECT (Полет камеры)
  // =========================================================
  useEffect(() => {
      if (focusTarget && mapRef.current) {
          const view = mapRef.current.getView();
          view.animate({
              center: fromLonLat([focusTarget.lng, focusTarget.lat]),
              zoom: focusTarget.zoom || 17,
              duration: 1500
          });
          // Опционально сбросить таргет, но не обязательно
      }
  }, [focusTarget]);


  // =========================================================
  // RENDER (UI)
  // =========================================================
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Контейнер карты */}
      <div ref={mapElement} style={{ width: '100%', height: '100%' }} />

      {/* Кастомный переключатель слоев */}
      <div style={{
          position: 'absolute', top: 10, right: 10, 
          background: 'white', padding: '5px', borderRadius: '4px',
          boxShadow: '0 0 5px rgba(0,0,0,0.3)', zIndex: 100
      }}>
          <select value={activeLayer} onChange={(e) => setActiveLayer(e.target.value)}>
              <option value="osm">Схема</option>
              <option value="satellite">Спутник</option>
              <option value="dark">Темная тема</option>
          </select>
      </div>
    </div>
  );
};

export default MapComponent;