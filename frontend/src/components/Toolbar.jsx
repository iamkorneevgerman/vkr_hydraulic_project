import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setMode } from "../store/uiSlice";
import {
  runCalculation,
  loadNetwork,
  loadProjectList,
} from "../store/networkSlice";
import {
  MousePointer2,
  MapPin,
  DraftingCompass,
  Play,
  Loader2,
  FileDown,
} from "lucide-react";
import { exportProjectToExcel } from "../utils/exportToExcel";

const Toolbar = () => {
  const dispatch = useDispatch();

  const { mode } = useSelector((state) => state.ui);
  const { calculationStatus, currentProjectId, nodes, pipes, projectsList } =
    useSelector((state) => state.network);

  useEffect(() => {
    dispatch(loadProjectList());
  }, [dispatch]);

  // АВТОВЫБОР ПЕРВОГО ПРОЕКТА
  useEffect(() => {
    // Если список проектов загрузился, и текущий проект еще не выбран
    if (projectsList && projectsList.length > 0 && !currentProjectId) {
      const firstProjectId = projectsList[0].id;
      dispatch(loadNetwork(firstProjectId)); // Автоматически загружаем первый
    }
  }, [projectsList, currentProjectId, dispatch]);

  const handleProjectChange = (e) => {
    const newProjectId = Number(e.target.value);
    if (newProjectId) {
      dispatch(loadNetwork(newProjectId));
    }
  };

  const handleCalculate = () => {
    if (currentProjectId) {
      dispatch(runCalculation(currentProjectId));
    } else {
      alert("Проект не загружен!");
    }
  };

  const handleExport = () => {
    exportProjectToExcel(nodes, pipes);
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
      {/* Выбор проекта */}
      <div
        style={{
          background: "rgba(255,255,255,0.8)",
          padding: "8px",
          borderRadius: "10px",
          backdropFilter: "blur(4px)",
          marginBottom: "10px",
        }}
      >
        <select
          value={currentProjectId || ""}
          onChange={handleProjectChange}
          style={{
            width: "100%",
            padding: "6px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          <option value="" disabled>
            Выберите проект...
          </option>

          {projectsList?.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.name}
            </option>
          ))}
        </select>
      </div>
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
          color="#28a745"
        />
      </div>

      {/* Группа Экспорта */}
      <div style={{ marginTop: "10px" }}>
        <ToolButton
          icon={FileDown}
          label="Экспорт в Excel"
          active={false}
          onClick={handleExport}
          color="#0056b3"
        />
      </div>
    </div>
  );
};

export default Toolbar;
