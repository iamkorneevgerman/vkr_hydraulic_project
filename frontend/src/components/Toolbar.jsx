
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { setMode } from "../store/uiSlice";
import { runCalculation } from "../store/networkSlice";

const Toolbar = () => {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.ui);
  const { calculationStatus, currentProjectId } = useSelector(
    (state) => state.network
  );

  // const PROJECT_ID = 4; Жестко заданный ID проекта

  const handleCalculate = () => {
    if (currentProjectId) {
      dispatch(runCalculation(currentProjectId));
    } else {
      alert("Проект не загружен!");
    }
  };

  const styles = {
    container: {
      position: "absolute",
      top: 10,
      left: 50,
      zIndex: 1000,
      background: "white",
      padding: "10px",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      display: "flex",
      gap: "10px",
    },
    btn: (isActive) => ({
      padding: "8px 12px",
      background: isActive ? "#007bff" : "#f0f0f0",
      color: isActive ? "white" : "black",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontWeight: "bold",
    }),
    calcBtn: {
      padding: "8px 12px",
      background: calculationStatus === "loading" ? "#6c757d" : "#28a745", // Зеленая или серая
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontWeight: "bold",
      marginLeft: "20px",
    },
  };

  return (
    <div style={styles.container}>
      <button
        style={styles.btn(mode === "view")}
        onClick={() => dispatch(setMode("view"))}
      >
        ✋ Перемещение (View)
      </button>
      <button
        style={styles.btn(mode === "add_node")}
        onClick={() => dispatch(setMode("add_node"))}
      >
        📍 Добавить Узел
      </button>
      <button
        style={styles.btn(mode === "add_pipe")}
        onClick={() => dispatch(setMode("add_pipe"))}
      >
        🔗 Добавить Трубу
      </button>
      <button
        style={styles.calcBtn}
        onClick={handleCalculate}
        disabled={calculationStatus === "loading"}
      >
        {calculationStatus === "loading" ? "⏳ Считаем..." : "▶ Рассчитать"}
      </button>
    </div>
  );
};

export default Toolbar;
