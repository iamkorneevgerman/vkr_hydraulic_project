// src/components/MapComponent.jsx
import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Layers } from "lucide-react";
import styles from "./MapComponent.module.css";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM, XYZ } from "ol/source";
import GeoJSON from "ol/format/GeoJSON";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { fromLonLat, toLonLat } from "ol/proj";
import { Translate } from "ol/interaction";

import { addNode, moveNode, addPipe } from "../store/networkSlice";
import {
  selectNode,
  setEditingElement,
  resetSelection,
} from "../store/uiSlice";

const MapComponent = () => {
  const dispatch = useDispatch();

  const { nodes, pipes, currentProjectId } = useSelector(
    (state) => state.network,
  );
  const { mode, selectedNodeId, focusTarget } = useSelector(
    (state) => state.ui,
  );

  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const nodesSource = useRef(new VectorSource());
  const pipesSource = useRef(new VectorSource());

  const [activeLayer, setActiveLayer] = useState("osm");

  // 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ
  useEffect(() => {
    if (!mapElement.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: true,
      properties: { name: "osm" },
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attributions: "Tiles © Esri",
      }),
      visible: false,
      properties: { name: "satellite" },
    });

    const darkLayer = new TileLayer({
      source: new XYZ({
        url: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attributions: "© OpenStreetMap, © CARTO",
      }),
      visible: false,
      properties: { name: "dark" },
    });

    const pipesLayer = new VectorLayer({
      source: pipesSource.current,
      style: pipeStyleFunction,
      zIndex: 1,
    });

    const nodesLayer = new VectorLayer({
      source: nodesSource.current,
      style: nodeStyleFunction,
      zIndex: 2,
    });

    const map = new Map({
      target: mapElement.current,
      layers: [osmLayer, satelliteLayer, darkLayer, pipesLayer, nodesLayer],
      view: new View({
        center: fromLonLat([37.57, 55.75]),
        zoom: 13,
      }),
    });

    mapRef.current = map;

    // Курсор pointer при наведении на объекты
    map.on("pointermove", (e) => {
      const hit = map.hasFeatureAtPixel(e.pixel);
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    return () => {
      map.setTarget(null);
    };
  }, []);

  // 2. СТИЛИЗАЦИЯ OL (Цвета труб и узлов)
  const pipeStyleFunction = (feature) => {
    const props = feature.getProperties();
    const velocity = props.calculated_velocity;
    let color = "#94a3b8";
    let width = 3;

    if (velocity != null) {
      if (velocity < 0.5)
        color = "#38bdf8";
      else if (velocity < 2.0)
        color = "#0284c7";
      else color = "#ef4444";
    }

    return new Style({
      stroke: new Stroke({ color, width }),
    });
  };

  const nodeStyleFunction = (feature) => {
    const props = feature.getProperties();
    const isSelected = props.selected;

    let color = props.node_type === "Reservoir" ? "#ef4444" : "#10b981";
    if (isSelected) color = "#eab308";

    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    });
  };

  // 3. СИНХРОНИЗАЦИЯ ДАННЫХ (Redux -> OL)
  useEffect(() => {
    if (!mapRef.current) return;

    const format = new GeoJSON({ featureProjection: "EPSG:3857" });

    // Узлы
    nodesSource.current.clear();
    if (nodes.length > 0) {
      const features = format.readFeatures({
        type: "FeatureCollection",
        features: nodes,
      });
      features.forEach((f) => {
        if (selectedNodeId && f.getId() === selectedNodeId)
          f.set("selected", true);
      });
      nodesSource.current.addFeatures(features);
    }

    // Трубы
    pipesSource.current.clear();
    if (pipes.length > 0) {
      const features = format.readFeatures({
        type: "FeatureCollection",
        features: pipes,
      });
      pipesSource.current.addFeatures(features);
    }
  }, [nodes, pipes, selectedNodeId]);

  // 4. УПРАВЛЕНИЕ СЛОЯМИ (Схема/Спутник)
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current
      .getLayers()
      .getArray()
      .forEach((layer) => {
        if (layer instanceof TileLayer && layer.get("name")) {
          layer.setVisible(layer.get("name") === activeLayer);
        }
      });
  }, [activeLayer]);

  // 5. ИНТЕРАКТИВ (Перемещение / Drag & Drop)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    map.getInteractions().forEach((interaction) => {
      if (interaction instanceof Translate) map.removeInteraction(interaction);
    });

    if (mode === "view") {
      const translate = new Translate({
        layers: [map.getLayers().getArray()[4]],
      }); // nodesLayer

      translate.on("translateend", (evt) => {
        const feature = evt.features.getArray()[0];
        const coords = toLonLat(feature.getGeometry().getCoordinates());
        const id = feature.getId();

        if (window.confirm(`Переместить узел ${id}?`)) {
          dispatch(moveNode({ id, lat: coords[1], lng: coords[0] }));
        } else {
          // Принудительно вызываем обновление из Redux, чтобы вернуть маркер на место
          nodesSource.current.clear();
          const format = new GeoJSON({ featureProjection: "EPSG:3857" });
          nodesSource.current.addFeatures(
            format.readFeatures({ type: "FeatureCollection", features: nodes }),
          );
        }
      });
      map.addInteraction(translate);
    }
  }, [mode, dispatch, nodes]);

  // 6. ОБРАБОТЧИК КЛИКОВ (Логика приложения)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const clickListener = (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);

      if (mode === "add_node" && !feature && currentProjectId) {
        const coords = toLonLat(evt.coordinate);
        dispatch(
          addNode({
            project: currentProjectId,
            name: `Новый узел`,
            node_type: "Junction",
            elevation: 0,
            geometry: { type: "Point", coordinates: coords },
          }),
        );
        return;
      }

      if (
        mode === "add_pipe" &&
        feature &&
        feature.getGeometry().getType() === "Point"
      ) {
        const nodeId = feature.getId();
        if (!selectedNodeId) {
          dispatch(selectNode(nodeId));
        } else if (selectedNodeId !== nodeId) {
          const startNode = nodes.find((n) => n.id === selectedNodeId);
          const endCoords = toLonLat(feature.getGeometry().getCoordinates());

          if (startNode) {
            dispatch(
              addPipe({
                project: currentProjectId,
                name: `Труба ${selectedNodeId}-${nodeId}`,
                from_node: selectedNodeId,
                to_node: nodeId,
                length: 100,
                diameter: 100,
                roughness_coefficient: 0.1,
                material: "new_steel",
                geometry: {
                  type: "LineString",
                  coordinates: [startNode.geometry.coordinates, endCoords],
                },
              }),
            );
            dispatch(resetSelection());
          }
        }
        return;
      }

      if (mode === "view" && feature) {
        const type =
          feature.getGeometry().getType() === "Point" ? "node" : "pipe";
        dispatch(setEditingElement({ type, id: feature.getId() }));
      }
    };

    map.on("click", clickListener);
    return () => map.un("click", clickListener);
  }, [mode, currentProjectId, selectedNodeId, nodes, dispatch]);

  // 7. ПОЛЕТ КАМЕРЫ (Focus Target)
  useEffect(() => {
    if (focusTarget && mapRef.current) {
      mapRef.current.getView().animate({
        center: fromLonLat([focusTarget.lng, focusTarget.lat]),
        zoom: focusTarget.zoom || 17,
        duration: 1200,
      });
    }
  }, [focusTarget]);

  // RENDER UI
  return (
    <div className={styles.mapWrapper}>
      <div ref={mapElement} className={styles.mapContainer} />

      <div className={styles.layersControl}>
        <span className={styles.layersLabel}>
          <Layers size={16} /> Картография:
        </span>
        <select
          className={styles.layersSelect}
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value)}
        >
          <option value="osm">Схема (OSM)</option>
          <option value="satellite">Спутник (Esri)</option>
          <option value="dark">Темная аналитика</option>
        </select>
      </div>
    </div>
  );
};

export default MapComponent;
