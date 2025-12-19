import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { setMode } from "../store/uiSlice";
import { runCalculation } from "../store/networkSlice";
import {
  MousePointer2,
  MapPin,
  DraftingCompass,
  Play,
  Loader2,
} from "lucide-react"; // Иконки

const Toolbar = () => {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.ui);
  const { calculationStatus, currentProjectId } = useSelector(
    (state) => state.network
  );

  const handleCalculate = () => {
    if (currentProjectId) {
      dispatch(runCalculation(currentProjectId));
    } else {
      alert("Проект не загружен!");
    }
  };

  // Компонент Кнопки с Подсказкой (Tooltip)
  const ToolButton = ({
    icon: Icon,
    label,
    active,
    onClick,
    disabled,
    color,
  }) => (
    <div
      className="tool-btn-wrapper"
      style={{ position: "relative", marginBottom: "8px" }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        title={label} // Стандартная подсказка браузера
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "8px",
          border: "none",
          background: active ? "#007bff" : "white",
          color: active ? "white" : color || "#444",
          boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Icon size={24} />
      </button>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "5px",
      }}
    >
      {/* Группа Редактирования */}
      <div
        style={{
          background: "rgba(255,255,255,0.5)",
          padding: "5px",
          borderRadius: "10px",
          backdropFilter: "blur(4px)",
        }}
      >
        <ToolButton
          icon={MousePointer2}
          label="Перемещение и Свойства (View)"
          active={mode === "view"}
          onClick={() => dispatch(setMode("view"))}
        />
        <ToolButton
          icon={MapPin}
          label="Добавить Узел"
          active={mode === "add_node"}
          onClick={() => dispatch(setMode("add_node"))}
        />
        <ToolButton
          icon={DraftingCompass}
          label="Проложить Трубу"
          active={mode === "add_pipe"}
          onClick={() => dispatch(setMode("add_pipe"))}
        />
      </div>

      {/* Группа Действий */}
      <div style={{ marginTop: "10px" }}>
        <ToolButton
          icon={calculationStatus === "loading" ? Loader2 : Play}
          label="Запустить Гидравлический Расчет"
          active={false}
          disabled={calculationStatus === "loading"}
          onClick={handleCalculate}
          color="#28a745" // Зеленая иконка Play
        />
      </div>
    </div>
  );
};

export default Toolbar;
