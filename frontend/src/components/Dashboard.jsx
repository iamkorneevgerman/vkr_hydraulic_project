import React, { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setFocusTarget, setEditingElement } from "../store/uiSlice";

// === CHART JS ИМПОРТЫ ===
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
// =========================

const Dashboard = () => {
  const dispatch = useDispatch();
  const { nodes, pipes, calculationStatus } = useSelector(
    (state) => state.network
  );

  // === 1. РАСЧЕТ СТАТИСТИКИ ===
  const stats = useMemo(() => {
    let totalLength = 0;
    let totalDemand = 0;

    pipes.forEach((p) => {
      totalLength += p.properties.length || 0;
    });

    nodes.forEach((n) => {
      if (n.properties.node_type === "Junction") {
        totalDemand += n.properties.base_demand || 0;
      }
    });

    return {
      nodesCount: nodes.length,
      pipesCount: pipes.length,
      totalLength: totalLength.toFixed(1),
      totalDemand: totalDemand.toFixed(4),
    };
  }, [nodes, pipes]);

  // === 2. ПОИСК ПРОБЛЕМ (АЛЕРТЫ) ===
  const alerts = useMemo(() => {
    const list = [];

    nodes.forEach((n) => {
      const p = n.properties.calculated_pressure;
      if (p !== null && p !== undefined) {
        if (p < 0) {
          list.push({
            type: "critical",
            msg: `Низкое давление (${p.toFixed(2)}м)`,
            element: n,
            elType: "node",
          });
        } else if (p > 100) {
          list.push({
            type: "warning",
            msg: `Высокое давление (${p.toFixed(2)}м)`,
            element: n,
            elType: "node",
          });
        }
      }
    });

    pipes.forEach((p) => {
      const v = p.properties.calculated_velocity;
      if (v !== null && v !== undefined) {
        if (v > 5.0) {
          list.push({
            type: "critical",
            msg: `Критич. скорость (${v.toFixed(2)} м/с)`,
            element: p,
            elType: "pipe",
          });
        } else if (v > 2.0) {
          list.push({
            type: "warning",
            msg: `Высокая скорость (${v.toFixed(2)} м/с)`,
            element: p,
            elType: "pipe",
          });
        }
      }
    });

    return list;
  }, [nodes, pipes]);

  // === 3. ОБРАБОТКА КЛИКА ПО АЛЕРТУ ===
  const handleAlertClick = (item) => {
    let lat, lng;

    if (item.elType === "node") {
      lng = item.element.geometry.coordinates[0];
      lat = item.element.geometry.coordinates[1];
    } else {
      lng = item.element.geometry.coordinates[0][0];
      lat = item.element.geometry.coordinates[0][1];
    }

    dispatch(setFocusTarget({ lat, lng, zoom: 18 }));
    dispatch(setEditingElement({ type: item.elType, id: item.element.id }));
  };

  // === ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКА ===
  const chartData = useMemo(() => {
    const points = [];

    nodes.forEach((n) => {
      const elev = n.properties.elevation;
      const press = n.properties.calculated_pressure;

      if (
        elev !== null &&
        elev !== undefined &&
        press !== null &&
        press !== undefined
      ) {
        points.push({ x: elev, y: press });
      }
    });

    return {
      datasets: [
        {
          label: "Узлы сети",
          data: points,
          backgroundColor: "rgba(53, 162, 235, 1)",
        },
      ],
    };
  }, [nodes]);

  const chartOptions = {
    scales: {
      x: {
        title: { display: true, text: "Высота земли (м)" },
        type: "linear",
        position: "bottom",
      },
      y: {
        title: { display: true, text: "Давление (м)" },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => `H=${ctx.parsed.x}м, P=${ctx.parsed.y.toFixed(2)}м`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  // === СТИЛИ ===
  const s = {
    container: { padding: "20px", fontFamily: "Arial, sans-serif" },
    card: {
      background: "white",
      padding: "15px",
      borderRadius: "8px",
      boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
      marginBottom: "10px",
    },
    title: { margin: "0 0 10px 0", fontSize: "18px", color: "#333" },
    statRow: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "5px",
      fontSize: "14px",
    },
    alertItem: (type) => ({
      padding: "10px",
      marginTop: "5px",
      borderRadius: "4px",
      cursor: "pointer",
      background: type === "critical" ? "#ffebee" : "#fff3e0",
      borderLeft:
        type === "critical" ? "4px solid #f44336" : "4px solid #ff9800",
      fontSize: "13px",
    }),
  };

  return (
    <div style={s.container}>
      <h2>📊 Аналитика сети</h2>

      {/* СТАТИСТИКА */}
      <div style={s.card}>
        <h3 style={s.title}>Сводка</h3>
        <div style={s.statRow}>
          <span>Всего узлов:</span>
          <b>{stats.nodesCount}</b>
        </div>
        <div style={s.statRow}>
          <span>Всего труб:</span>
          <b>{stats.pipesCount}</b>
        </div>
        <div style={s.statRow}>
          <span>Длина сети:</span>
          <b>{stats.totalLength} м</b>
        </div>
        <div style={s.statRow}>
          <span>Потребление:</span>
          <b>{stats.totalDemand} м³/с</b>
        </div>
      </div>

      {/* ПРОБЛЕМЫ */}
      {calculationStatus === "success" && (
        <div style={s.card}>
          <h3 style={s.title}>
            Состояние системы
            {alerts.length === 0 && (
              <span style={{ color: "green", marginLeft: "10px" }}>
                ✔ Норма
              </span>
            )}
          </h3>

          {alerts.map((item, idx) => (
            <div
              key={idx}
              style={s.alertItem(item.type)}
              onClick={() => handleAlertClick(item)}
            >
              <strong>
                {item.elType === "node" ? "Узел" : "Труба"} {item.element.id}:
              </strong>{" "}
              {item.msg}
            </div>
          ))}
        </div>
      )}

      {/* === ГРАФИК === */}
      {calculationStatus === "success" && (
        <div style={s.card}>
          <h3 style={s.title}>Зависимость P(H)</h3>
          <div style={{ height: "200px" }}>
            <Scatter data={chartData} options={chartOptions} />
          </div>
          <small style={{ color: "#777", fontSize: "11px" }}>
            Физическая корреляция: чем ниже точка, тем выше давление.
          </small>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
