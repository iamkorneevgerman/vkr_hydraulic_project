// src/components/Dashboard.jsx
import React, { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setFocusTarget, setEditingElement } from "../store/uiSlice";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplet,
  MapPin,
  Ruler,
} from "lucide-react";
import styles from "./Dashboard.module.css";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip);

const Dashboard = () => {
  const dispatch = useDispatch();
  const { nodes, pipes, calculationStatus } = useSelector(
    (state) => state.network,
  );

  // === 1. РАСЧЕТ СТАТИСТИКИ ===
  const stats = useMemo(() => {
    let totalLength = 0;
    let totalDemand = 0;

    pipes.forEach((p) => {
      totalLength += p.properties.length || 0;
    });
    nodes.forEach((n) => {
      if (n.properties.node_type === "Junction")
        totalDemand += n.properties.base_demand || 0;
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
      if (p != null) {
        if (p < 0)
          list.push({
            type: "critical",
            msg: `Отрицательное давление (${p.toFixed(2)}м)`,
            element: n,
            elType: "node",
          });
        else if (p > 100)
          list.push({
            type: "warning",
            msg: `Избыточное давление (${p.toFixed(2)}м)`,
            element: n,
            elType: "node",
          });
      }
    });

    pipes.forEach((p) => {
      const v = p.properties.calculated_velocity;
      if (v != null) {
        if (v > 5.0)
          list.push({
            type: "critical",
            msg: `Критическая скорость (${v.toFixed(2)} м/с)`,
            element: p,
            elType: "pipe",
          });
        else if (v > 2.0)
          list.push({
            type: "warning",
            msg: `Повышенная скорость (${v.toFixed(2)} м/с)`,
            element: p,
            elType: "pipe",
          });
      }
    });

    return list;
  }, [nodes, pipes]);

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

  // === 3. ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКА ===
  const chartData = useMemo(() => {
    const points = nodes
      .filter(
        (n) =>
          n.properties.elevation != null &&
          n.properties.calculated_pressure != null,
      )
      .map((n) => ({
        x: n.properties.elevation,
        y: n.properties.calculated_pressure,
      }));

    return {
      datasets: [
        {
          label: "Узлы сети",
          data: points,
          backgroundColor: "#0ea5e9",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [nodes]);

  const chartOptions = {
    scales: {
      x: {
        title: { display: true, text: "Высота рельефа (м)", color: "#64748b" },
        grid: { color: "#f1f5f9" },
        border: { display: false },
      },
      y: {
        title: { display: true, text: "Давление (м)", color: "#64748b" },
        grid: { color: "#f1f5f9" },
        border: { display: false },
      },
    },
    plugins: {
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 10,
        callbacks: {
          label: (ctx) => `H: ${ctx.parsed.x}м, P: ${ctx.parsed.y.toFixed(2)}м`,
        },
      },
      legend: { display: false },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.mainTitle}>
        <Activity size={24} color="#0ea5e9" /> Аналитика сети
      </h2>

      {/* --- СВОДКА --- */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Сводка проекта</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>
              <MapPin size={14} /> Узлы
            </span>
            <span className={styles.statValue}>{stats.nodesCount}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>
              <Ruler size={14} /> Трубы
            </span>
            <span className={styles.statValue}>{stats.pipesCount}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>
              <Activity size={14} /> Длина сети
            </span>
            <span className={styles.statValue}>{stats.totalLength} м</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>
              <Droplet size={14} /> Потребление
            </span>
            <span className={styles.statValue}>{stats.totalDemand}</span>
          </div>
        </div>
      </div>

      {/* --- СОСТОЯНИЕ (АЛЕРТЫ) --- */}
      {calculationStatus === "success" ? (
        <>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Валидация расчета
              {alerts.length === 0 && (
                <span className={styles.statusNormal}>
                  <CheckCircle2 size={16} /> В норме
                </span>
              )}
            </h3>

            <div className={styles.alertList}>
              {alerts.map((item, idx) => (
                <div
                  key={idx}
                  className={`${styles.alertCard} ${item.type === "critical" ? styles.alertCritical : styles.alertWarning}`}
                  onClick={() => handleAlertClick(item)}
                >
                  <AlertTriangle className={styles.alertIcon} size={18} />
                  <div className={styles.alertContent}>
                    <span className={styles.alertTitle}>
                      {item.elType === "node" ? "Узел" : "Труба"} ID:{" "}
                      {item.element.id}
                    </span>
                    <span className={styles.alertMsg}>{item.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* --- ГРАФИК --- */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Пьезометрический график P(H)
            </h3>
            <div className={styles.chartContainer}>
              <Scatter data={chartData} options={chartOptions} />
            </div>
            <span className={styles.chartNote}>
              Распределение давления относительно рельефа
            </span>
          </div>
        </>
      ) : (
        <div className={styles.section}>
          <div className={styles.emptyState}>
            Выполните расчет, чтобы увидеть анализ давлений и скоростей.
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
