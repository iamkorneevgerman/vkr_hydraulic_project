// src/App.jsx
import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { loadNetwork } from "./store/networkSlice";
import MapComponent from "./components/MapComponent";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // ВОТ ЗДЕСЬ МЫ ЗАДАЕМ ID ПРОЕКТА ОДИН РАЗ
    const MY_PROJECT_ID = 4;

    dispatch(loadNetwork(MY_PROJECT_ID));
  }, [dispatch]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <Toolbar />
        <MapComponent />
      </div>

      <Sidebar />
    </div>
  );
}

export default App;
