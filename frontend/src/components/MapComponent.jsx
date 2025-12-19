// src/components/MapComponent.jsx
import React, { useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
  LayersControl,
} from "react-leaflet";
import { useSelector, useDispatch } from "react-redux";
import { addNode, moveNode, addPipe } from "../store/networkSlice";
import {
  selectNode,
  setEditingElement,
  resetSelection,
} from "../store/uiSlice";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import MapEffect from "./MapEffect";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= MapClickHandler ================= */

const MapClickHandler = () => {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.ui);
  const currentProjectId = useSelector(
    (state) => state.network.currentProjectId
  );

  useMapEvents({
    click(e) {
      if (mode === "add_node" && currentProjectId) {
        dispatch(
          addNode({
            project: currentProjectId,
            name: `Узел ${Date.now()}`,
            node_type: "Junction",
            elevation: 0,
            geometry: {
              type: "Point",
              coordinates: [e.latlng.lng, e.latlng.lat],
            },
          })
        );
      }
    },
  });

  return null;
};

/* ================= NodeMarker ================= */

const NodeMarker = ({
  node,
  mode,
  selectedNodeId,
  dispatch,
  nodes,
  currentProjectId,
}) => {
  const markerRef = useRef(null);
  const position = [node.geometry.coordinates[1], node.geometry.coordinates[0]];
  const opacity = mode === "add_pipe" && selectedNodeId === node.id ? 0.5 : 1;

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          if (window.confirm(`Переместить узел ${node.id}?`)) {
            dispatch(moveNode({ id: node.id, lat, lng }));
          } else {
            marker.setLatLng(position);
          }
        }
      },
      click(e) {
        L.DomEvent.stopPropagation(e);

        if (mode === "add_pipe") {
          if (!selectedNodeId) {
            dispatch(selectNode(node.id));
          } else if (selectedNodeId !== node.id) {
            const startNode = nodes.find((n) => n.id === selectedNodeId);
            if (startNode) {
              dispatch(
                addPipe({
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
                })
              );
              dispatch(resetSelection());
              alert("Труба создана!");
            }
          }
        } else if (mode === "view") {
          dispatch(setEditingElement({ type: "node", id: node.id }));
        }
      },
    }),
    [node, mode, selectedNodeId, nodes, position, dispatch, currentProjectId]
  );

  return (
    <Marker
      ref={markerRef}
      position={position}
      draggable={mode === "view"}
      opacity={opacity}
      eventHandlers={eventHandlers}
    />
  );
};

/* ================= MapComponent ================= */

const MapComponent = () => {
  const dispatch = useDispatch();
  const { nodes, pipes, currentProjectId } = useSelector(
    (state) => state.network
  );
  const { mode, selectedNodeId } = useSelector((state) => state.ui);

  return (
    <MapContainer
      center={[55.75, 37.57]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      {/* ===== ПЕРЕКЛЮЧЕНИЕ СЛОЕВ ===== */}
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Схема (OSM)">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Спутник (Esri)">
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Темная тема">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        </LayersControl.BaseLayer>
      </LayersControl>

      <MapEffect />
      <MapClickHandler />

      {/* ===== ТРУБЫ ===== */}
      {pipes.map((pipe) => {
        if (!pipe.geometry) return null;
        const positions = pipe.geometry.coordinates.map((c) => [c[1], c[0]]);
        return (
          <Polyline
            key={pipe.id}
            positions={positions}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (mode === "view") {
                  dispatch(setEditingElement({ type: "pipe", id: pipe.id }));
                }
              },
            }}
          />
        );
      })}

      {/* ===== УЗЛЫ ===== */}
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
