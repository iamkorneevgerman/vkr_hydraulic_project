import React, { useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
} from "react-leaflet";
import { useSelector, useDispatch } from "react-redux";
import { addNode, moveNode, addPipe } from "../store/networkSlice";
import {
  selectNode,
  setMode,
  setEditingElement,
  resetSelection,
} from "../store/uiSlice";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Компонент для клика по пустому месту (Создание узла)
const MapClickHandler = () => {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.ui);
  const currentProjectId = useSelector(
    (state) => state.network.currentProjectId
  );

  useMapEvents({
    click(e) {
      if (mode === "add_node" && currentProjectId) {
        const newNode = {
          project: currentProjectId,
          name: `Узел ${Date.now()}`,
          node_type: "Junction",
          elevation: 0,
          geometry: {
            type: "Point",
            coordinates: [e.latlng.lng, e.latlng.lat],
          },
        };
        dispatch(addNode(newNode));
      }
    },
  });
  return null;
};

// Компонент одного маркера
const NodeMarker = ({
  node,
  mode,
  selectedNodeId,
  dispatch,
  nodes,
  currentProjectId,
}) => {
  const markerRef = useRef(null);
  

  // Координаты для Leaflet [lat, lon]
  const position = [node.geometry.coordinates[1], node.geometry.coordinates[0]];

  // Определяем, нужно ли затемнить маркер
  const opacity = mode === "add_pipe" && selectedNodeId === node.id ? 0.5 : 1.0;

  const eventHandlers = useMemo(
    () => ({
      // Когда маркер перетащили и отпустили
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          if (window.confirm(`Переместить узел ${node.id}?`)) {
            dispatch(moveNode({ id: node.id, lat, lng }));
          } else {
            // Возвращаем на место при отмене
            marker.setLatLng(position);
          }
        }
      },

      // Клик по маркеру
      click(e) {
        L.DomEvent.stopPropagation(e);

        // Режим добавления трубы
        if (mode === "add_pipe") {
          if (!selectedNodeId) {
            // 1. Выбираем первый узел
            dispatch(selectNode(node.id));
          } else if (selectedNodeId !== node.id) {
            // 2. Выбираем второй узел и создаем трубу
            const startNode = nodes.find((n) => n.id === selectedNodeId);

            if (startNode) {
              const newPipe = {
                project: currentProjectId,
                name: `Труба ${selectedNodeId}-${node.id}`,
                from_node: selectedNodeId,
                to_node: node.id,
                length: 100,
                diameter: 100,
                roughness_coefficient: 0.1,
                material: "Сталь",
                geometry: {
                  type: "LineString",
                  coordinates: [
                    startNode.geometry.coordinates,
                    node.geometry.coordinates,
                  ],
                },
              };
              dispatch(addPipe(newPipe));
              dispatch(resetSelection());
              alert("Труба создана!");
            }
          }
        }
        // Режим просмотра - открываем боковую панель
        else if (mode === "view") {
          dispatch(setEditingElement({ type: "node", id: node.id }));
        }
        // Режим добавления узла - ничего не делаем (клики обрабатываются MapClickHandler)
      },
    }),
    [node, mode, selectedNodeId, dispatch, nodes, position, currentProjectId]
  );

  return (
    <Marker
      ref={markerRef}
      position={position}
      draggable={mode === "view"}
      opacity={opacity}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <strong>Узел {node.id}</strong>
        <br />
        Тип: {node.properties?.node_type || "Junction"}
        <br />
        Название: {node.properties?.name || "Не указано"}
      </Popup>
    </Marker>
  );
};

const MapComponent = () => {
  const dispatch = useDispatch();
  const { nodes, pipes, currentProjectId } = useSelector(
    (state) => state.network
  );
  const { mode, selectedNodeId } = useSelector((state) => state.ui);

  const getPipeColor = (pipe) => {
    // Используем ?. (опциональную цепочку) для защиты
    const velocity = pipe.properties?.calculated_velocity;

    // Если скорость не посчитана или равна null/undefined
    if (velocity == null) return "gray";

    // Если скорость 0 (или очень близка к 0)
    if (Math.abs(velocity) < 0.001) return "gray";

    // Градация цветов
    if (velocity < 0.5) return "#00BFFF"; // DeepSkyBlue
    if (velocity < 2.0) return "blue";
    return "red";
  };

  // Функция толщины линии (чем больше расход, тем толще)
  const getPipeWeight = (pipe) => {
    // Пример: базовые 4px + расход * 10 (но не более 10px)
    const flow = Math.abs(pipe.properties.calculated_flow_rate || 0);
    return Math.min(4 + flow * 50, 10);
  };

  return (
    <MapContainer
      center={[55.75, 37.57]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler />

      {/* Отрисовка труб */}
      {pipes.map((pipe) => {
        if (!pipe.geometry || !pipe.geometry.coordinates) return null;

        const positions = pipe.geometry.coordinates.map((c) => [c[1], c[0]]);
        const color = getPipeColor(pipe);
        const weight = getPipeWeight(pipe);

        return (
          <Polyline
            key={pipe.id}
            positions={positions}
            color={color}
            weight={weight}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (mode === "view") {
                  dispatch(setEditingElement({ type: "pipe", id: pipe.id }));
                }
              },
            }}
          >
            <Popup>
              Труба ID: {pipe.id}
              <br />
              {/* Если значение есть, то округляем. Если нет - пишем прочерк */}
              V:{" "}
              {pipe.properties.calculated_velocity != null
                ? pipe.properties.calculated_velocity.toFixed(2)
                : "-"}{" "}
              м/с
              <br />
              Q:{" "}
              {pipe.properties.calculated_flow_rate != null
                ? pipe.properties.calculated_flow_rate.toFixed(4)
                : "-"}
            </Popup>
          </Polyline>
        );
      })}

      {/* Отрисовка узлов */}
      {nodes.map((node) => (
        <NodeMarker
          key={node.id}
          node={node}
          mode={mode}
          selectedNodeId={selectedNodeId}
          dispatch={dispatch}
          nodes={nodes}
          currentProjectId={currentProjectId}
        />
      ))}
    </MapContainer>
  );
};

export default MapComponent;
