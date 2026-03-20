// src/components/Toolbar.jsx
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
  LogOut,
  User,
} from "lucide-react";
import { exportProjectToExcel } from "../utils/exportToExcel";
import { logout } from "../store/authSlice";
import styles from "./Toolbar.module.css";

const Toolbar = () => {
  const dispatch = useDispatch();

  const { mode } = useSelector((state) => state.ui);
  const { calculationStatus, currentProjectId, nodes, pipes, projectsList } =
    useSelector((state) => state.network);
  const { username } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(loadProjectList());
  }, [dispatch]);

  useEffect(() => {
    if (projectsList?.length > 0 && !currentProjectId) {
      dispatch(loadNetwork(projectsList[0].id));
    }
  }, [projectsList, currentProjectId, dispatch]);

  const handleProjectChange = (e) => {
    const newId = Number(e.target.value);
    if (newId) dispatch(loadNetwork(newId));
  };

  const handleCalculate = () => {
    if (currentProjectId) dispatch(runCalculation(currentProjectId));
    else alert("Проект не загружен!");
  };

  return (
    <div className={styles.toolbarContainer}>
      {/* --- БЛОК 1: Юзер и Проект --- */}
      <div className={styles.topPanel}>
        <div className={styles.userInfo}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <User size={14} /> {username}
          </span>
          <span
            className={styles.logoutBtn}
            onClick={() => dispatch(logout())}
            title="Выйти"
          >
            <LogOut size={16} />
          </span>
        </div>
        <select
          className={styles.projectSelect}
          value={currentProjectId || ""}
          onChange={handleProjectChange}
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

      {/* --- БЛОК 2: Инструменты Карты --- */}
      <div className={styles.toolsPanel}>
        <button
          className={`${styles.toolBtn} ${mode === "view" ? styles.toolBtnActive : ""}`}
          onClick={() => dispatch(setMode("view"))}
          title="Перемещение и выбор"
        >
          <MousePointer2 size={22} />
        </button>
        <button
          className={`${styles.toolBtn} ${mode === "add_node" ? styles.toolBtnActive : ""}`}
          onClick={() => dispatch(setMode("add_node"))}
          title="Добавить Узел"
        >
          <MapPin size={22} />
        </button>
        <button
          className={`${styles.toolBtn} ${mode === "add_pipe" ? styles.toolBtnActive : ""}`}
          onClick={() => dispatch(setMode("add_pipe"))}
          title="Проложить Трубу"
        >
          <DraftingCompass size={22} />
        </button>

        <div className={styles.separator} />

        {/* Экшены: Расчет */}
        <button
          className={`${styles.toolBtn} ${styles.calcBtn} ${calculationStatus === "loading" ? styles.toolBtnDisabled : ""}`}
          onClick={handleCalculate}
          disabled={calculationStatus === "loading"}
          title="Запустить Гидравлический Расчет"
        >
          {calculationStatus === "loading" ? (
            <Loader2 size={22} className="lucide-spin" />
          ) : (
            <Play size={22} fill="currentColor" />
          )}
        </button>

        {/* Экшены: Экспорт */}
        <button
          className={`${styles.toolBtn} ${styles.exportBtn}`}
          onClick={() => exportProjectToExcel(nodes, pipes)}
          title="Экспорт в Excel"
        >
          <FileDown size={22} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
