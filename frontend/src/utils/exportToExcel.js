// src/utils/exportToExcel.js
import * as XLSX from "xlsx";

export const exportProjectToExcel = (nodes, pipes) => {
  // 1. Подготовка данных Узлов
  const nodesData = nodes.map((n) => ({
    ID: n.id,
    Название: n.properties.name,
    Тип: n.properties.node_type === "Reservoir" ? "Источник" : "Потребитель",
    "Отметка земли (м)": n.properties.elevation,
    "Напор источника (м)": n.properties.fixed_head || "-",
    "Потребление (м3/с)": n.properties.base_demand || 0,
    "Расчетное давление (м)":
      n.properties.calculated_pressure?.toFixed(2) || "-",
  }));

  // 2. Подготовка данных Труб
  const pipesData = pipes.map((p) => ({
    ID: p.id,
    Название: p.properties.name,
    "Длина (м)": p.properties.length,
    "Диаметр (мм)": p.properties.diameter,
    Материал: p.properties.material || "Custom",
    Шероховатость: p.properties.roughness_coefficient,
    "Расход (м3/с)": p.properties.calculated_flow_rate?.toFixed(4) || "-",
    "Скорость (м/с)": p.properties.calculated_velocity?.toFixed(2) || "-",
    "Потери напора (м)": p.properties.calculated_head_loss?.toFixed(2) || "-",
  }));

  // 3. Создаем новую книгу Excel
  const workbook = XLSX.utils.book_new();

  // 4. Создаем листы
  const worksheetNodes = XLSX.utils.json_to_sheet(nodesData);
  const worksheetPipes = XLSX.utils.json_to_sheet(pipesData);

  // Настройка ширины колонок (для красоты)
  const wscols = [
    { wch: 5 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
  ];
  worksheetNodes["!cols"] = wscols;
  worksheetPipes["!cols"] = wscols;

  // 5. Добавляем листы в книгу
  XLSX.utils.book_append_sheet(workbook, worksheetNodes, "Узлы");
  XLSX.utils.book_append_sheet(workbook, worksheetPipes, "Трубы");

  // 6. Скачиваем файл
  XLSX.writeFile(workbook, "Hydraulic_Report.xlsx");
};
