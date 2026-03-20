import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadNetwork } from "./store/networkSlice";
import MapComponent from "./components/MapComponent";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import AuthPage from "./components/AuthPage";

function App() {
  const dispatch = useDispatch();

  const { currentProjectId } = useSelector((state) => state.network);
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && currentProjectId) {
      dispatch(loadNetwork(currentProjectId));
    }
  }, [dispatch, currentProjectId, isAuthenticated]);

  // Если не авторизован — блокируем всё
  if (!isAuthenticated) {
    return <AuthPage />;
  }

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
