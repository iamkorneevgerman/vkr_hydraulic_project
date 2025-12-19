import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { closeSidebar } from "../store/uiSlice";
import { updateNode } from "../store/networkSlice";
import { updatePipe } from "../store/networkSlice";
import Dashboard from "./Dashboard";

const Sidebar = () => {
  const dispatch = useDispatch();
  const { editingElement } = useSelector((state) => state.ui);
  const { nodes, pipes } = useSelector((state) => state.network);

  // Локальное состояние формы (чтобы можно было печатать в инпутах)
  const [formData, setFormData] = useState({});

  // Когда меняется выбранный элемент, заполняем форму его данными
  useEffect(() => {
    if (!editingElement) return;

    let data = null;
    if (editingElement.type === "node") {
      data = nodes.find((n) => n.id === editingElement.id);
    } else if (editingElement.type === "pipe") {
      data = pipes.find((p) => p.id === editingElement.id);
    }

    if (data) {
      // Берем свойства из properties (GeoJSON) + имя
      setFormData({
        name: data.properties.name || "",
        ...data.properties, // elevation, diameter, node_type и т.д.
      });
    }
  }, [editingElement, nodes, pipes]);

  // Если ничего не выбрано — не рисуем панель
  if (!editingElement) {
    // Обертка для стилей, чтобы Dashboard выглядел так же, как панель
    return (
      <div
        style={{
          width: "320px",
          height: "100%",
          background: "#f4f4f4",
          borderLeft: "1px solid #ccc",
          overflowY: "auto",
        }}
      >
        <Dashboard />
      </div>
    );
  }
  // Обработчик изменения инпутов
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Сохранение
  const handleSave = () => {
    if (editingElement.type === "node") {
      // У узла обновляем properties. В API (Django) поля лежат на верхнем уровне или внутри
      // GeoFeatureModelSerializer ожидает плоскую структуру для полей модели.
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
        })
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
          },
        })
      );
    }
    alert("Сохранено!");
  };

  const styles = {
    container: {
      width: "320px",
      height: "100%",
      background: "#f8f9fa",
      borderLeft: "1px solid #ddd",
      padding: "20px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      overflowY: "auto",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    inputGroup: { display: "flex", flexDirection: "column", gap: "5px" },
    input: { padding: "5px", border: "1px solid #ccc", borderRadius: "4px" },
    btnSave: {
      padding: "10px",
      background: "#28a745",
      color: "white",
      border: "none",
      cursor: "pointer",
      marginTop: "20px",
    },
    btnClose: {
      background: "transparent",
      border: "none",
      fontSize: "20px",
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>
          Редактирование: {editingElement.type === "node" ? "Узел" : "Труба"}
        </h3>
        <button
          style={styles.btnClose}
          onClick={() => dispatch(closeSidebar())}
        >
          ×
        </button>
      </div>
      <p>ID: {editingElement.id}</p>

      {/* Общее поле: Имя */}
      <div style={styles.inputGroup}>
        <label>Название</label>
        <input
          style={styles.input}
          name="name"
          value={formData.name || ""}
          onChange={handleChange}
        />
      </div>

      {/* Поля ТОЛЬКО для УЗЛА */}
      {editingElement.type === "node" && (
        <>
          <div style={styles.inputGroup}>
            <label>Тип узла</label>
            <select
              style={styles.input}
              name="node_type"
              value={formData.node_type || "Junction"}
              onChange={handleChange}
            >
              <option value="Junction">Соединение (Потребитель)</option>
              <option value="Reservoir">Резервуар (Источник)</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label>Отметка земли (м)</label>
            <input
              style={styles.input}
              type="number"
              name="elevation"
              value={formData.elevation || 0}
              onChange={handleChange}
            />
          </div>

          {formData.node_type === "Junction" && (
            <div style={styles.inputGroup}>
              <label>Потребление (м³/с)</label>
              <input
                style={styles.input}
                type="number"
                step="0.001"
                name="base_demand"
                value={formData.base_demand || 0}
                onChange={handleChange}
              />
            </div>
          )}

          {formData.node_type === "Reservoir" && (
            <div style={styles.inputGroup}>
              <label>Напор источника (м)</label>
              <input
                style={styles.input}
                type="number"
                name="fixed_head"
                value={formData.fixed_head || 0}
                onChange={handleChange}
              />
            </div>
          )}

          {/* Результаты расчета (только чтение) */}
          <div
            style={{
              marginTop: "20px",
              padding: "10px",
              background: "#e9ecef",
            }}
          >
            <strong>Результаты:</strong>
            <br />
            Давление:{" "}
            {formData.calculated_pressure
              ? parseFloat(formData.calculated_pressure).toFixed(2)
              : "-"}{" "}
            м
          </div>
        </>
      )}

      {/* Поля ТОЛЬКО для ТРУБЫ */}
      {editingElement.type === "pipe" && (
        <>
          <div style={styles.inputGroup}>
            <label>Длина (м)</label>
            <input
              style={styles.input}
              type="number"
              name="length"
              value={formData.length || 0}
              onChange={handleChange}
            />
          </div>
          <div style={styles.inputGroup}>
            <label>Диаметр (мм)</label>
            <input
              style={styles.input}
              type="number"
              name="diameter"
              value={formData.diameter || 0}
              onChange={handleChange}
            />
          </div>
          <div style={styles.inputGroup}>
            <label>Шероховатость (мм)</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              name="roughness_coefficient"
              value={formData.roughness_coefficient || 0.1}
              onChange={handleChange}
            />
          </div>

          {/* Результаты расчета (только чтение) */}
          <div
            style={{
              marginTop: "20px",
              padding: "10px",
              background: "#e9ecef",
            }}
          >
            <strong>Результаты:</strong>
            <br />
            Расход:{" "}
            {formData.calculated_flow_rate
              ? parseFloat(formData.calculated_flow_rate).toFixed(4)
              : "-"}{" "}
            <br />
            Скорость:{" "}
            {formData.calculated_velocity
              ? parseFloat(formData.calculated_velocity).toFixed(2)
              : "-"}{" "}
            м/с
          </div>
        </>
      )}

      <button style={styles.btnSave} onClick={handleSave}>
        Сохранить
      </button>
    </div>
  );
};

export default Sidebar;
