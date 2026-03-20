// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeSidebar } from "../store/uiSlice";
import {
  updateNode,
  updatePipe,
  removeNode,
  removePipe,
} from "../store/networkSlice";
import Dashboard from "./Dashboard";
import styles from "./Sidebar.module.css";

const materialsDB = {
  new_steel: { label: "Сталь (новая)", roughness: 0.05 },
  old_steel: { label: "Сталь (старая)", roughness: 1.0 },
  plastic: { label: "Пластик / ПНД", roughness: 0.01 },
  cast_iron: { label: "Чугун", roughness: 0.25 },
  custom: { label: "Другое...", roughness: 0.1 },
};

const Sidebar = () => {
  const dispatch = useDispatch();
  const { editingElement } = useSelector((state) => state.ui);
  const { nodes, pipes } = useSelector((state) => state.network);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!editingElement) return;

    let data =
      editingElement.type === "node"
        ? nodes.find((n) => n.id === editingElement.id)
        : pipes.find((p) => p.id === editingElement.id);

    if (data) {
      setFormData({
        name: data.properties.name || "",
        ...data.properties,
      });
    }
  }, [editingElement, nodes, pipes]);

  if (!editingElement) {
    return (
      <div className={styles.dashboardWrapper}>
        <Dashboard />
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMaterialChange = (e) => {
    const matKey = e.target.value;
    setFormData((prev) => ({
      ...prev,
      material: matKey,
      roughness_coefficient:
        matKey === "custom"
          ? prev.roughness_coefficient
          : materialsDB[matKey].roughness,
    }));
  };

  const handleSave = () => {
    if (editingElement.type === "node") {
      dispatch(
        updateNode({
          id: editingElement.id,
          data: {
            name: formData.name,
            node_type: formData.node_type,
            elevation: parseFloat(formData.elevation),
            base_demand: parseFloat(formData.base_demand || 0),
            fixed_head: formData.fixed_head
              ? parseFloat(formData.fixed_head)
              : null,
          },
        }),
      );
    } else {
      dispatch(
        updatePipe({
          id: editingElement.id,
          data: {
            name: formData.name,
            length: parseFloat(formData.length),
            diameter: parseFloat(formData.diameter),
            roughness_coefficient: parseFloat(formData.roughness_coefficient),
            material: formData.material,
          },
        }),
      );
    }
  };

  const handleDelete = () => {
    if (window.confirm("Удалить этот элемент? Действие необратимо.")) {
      if (editingElement.type === "node")
        dispatch(removeNode(editingElement.id));
      else dispatch(removePipe(editingElement.id));
      dispatch(closeSidebar());
    }
  };

  const isNode = editingElement.type === "node";

  return (
    <aside className={styles.sidebarWrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Свойства элемента</h3>
          <span className={styles.subtitle}>
            {isNode ? "Узел" : "Участок трубы"} #{editingElement.id}
          </span>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => dispatch(closeSidebar())}
          title="Закрыть"
        >
          ×
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Название</label>
          <input
            className={styles.input}
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
          />
        </div>

        {/* --- ПОЛЯ УЗЛА --- */}
        {isNode && (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Тип узла</label>
              <select
                className={styles.select}
                name="node_type"
                value={formData.node_type || "Junction"}
                onChange={handleChange}
              >
                <option value="Junction">Соединение (Потребитель)</option>
                <option value="Reservoir">Резервуар (Источник)</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Отметка земли (м)</label>
              <input
                className={styles.input}
                type="number"
                name="elevation"
                value={formData.elevation || 0}
                onChange={handleChange}
              />
            </div>

            {formData.node_type === "Junction" ? (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Потребление (м³/с)</label>
                <input
                  className={styles.input}
                  type="number"
                  step="0.001"
                  name="base_demand"
                  value={formData.base_demand || 0}
                  onChange={handleChange}
                />
              </div>
            ) : (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Напор источника (м)</label>
                <input
                  className={styles.input}
                  type="number"
                  name="fixed_head"
                  value={formData.fixed_head || 0}
                  onChange={handleChange}
                />
              </div>
            )}

            {formData.calculated_pressure != null && (
              <div className={styles.resultsPanel}>
                <h4 className={styles.resultsTitle}>Анализ</h4>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Давление:</span>
                  <span className={styles.resultValue}>
                    {parseFloat(formData.calculated_pressure).toFixed(2)} м
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* --- ПОЛЯ ТРУБЫ --- */}
        {!isNode && (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Длина (м)</label>
              <input
                className={styles.input}
                type="number"
                name="length"
                value={formData.length || 0}
                onChange={handleChange}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Диаметр (мм)</label>
              <input
                className={styles.input}
                type="number"
                name="diameter"
                value={formData.diameter || 0}
                onChange={handleChange}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Материал</label>
              <select
                className={styles.select}
                name="material"
                value={formData.material || "custom"}
                onChange={handleMaterialChange}
              >
                {Object.entries(materialsDB).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Шероховатость (мм)</label>
              <input
                className={`${styles.input} ${formData.material !== "custom" ? styles.inputReadOnly : ""}`}
                type="number"
                step="0.01"
                name="roughness_coefficient"
                value={formData.roughness_coefficient || 0}
                onChange={handleChange}
                readOnly={formData.material !== "custom"}
              />
              {formData.material !== "custom" && (
                <span className={styles.hint}>Автоматически по материалу</span>
              )}
            </div>

            {formData.calculated_flow_rate != null && (
              <div className={styles.resultsPanel}>
                <h4 className={styles.resultsTitle}>Гидравлика</h4>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Расход (Q):</span>
                  <span className={styles.resultValue}>
                    {Math.abs(formData.calculated_flow_rate).toFixed(4)} м³/с
                  </span>
                </div>
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Скорость (V):</span>
                  <span className={styles.resultValue}>
                    {Math.abs(formData.calculated_velocity).toFixed(2)} м/с
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSave} onClick={handleSave}>
          Сохранить изменения
        </button>
        <button className={styles.btnDelete} onClick={handleDelete}>
          Удалить элемент
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
