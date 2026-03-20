import axios from "axios";

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: "/api", // Vite проксирует это на http://127.0.0.1:8000/api
});

// === ИНТЕРСЕПТОР (АВТО-ПОДСТАНОВКА ТОКЕНА) ===
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// === АВТОРИЗАЦИЯ ===
export const loginUser = async (username, password) => {
  const response = await api.post("/auth/login/", {
    username,
    password,
  });

  // Сохраняем токены
  localStorage.setItem("access_token", response.data.access);
  localStorage.setItem("refresh_token", response.data.refresh);

  return response.data;
};

export const registerUser = async (username, password) => {
  const response = await api.post("/auth/register/", {
    username,
    password,
  });

  return response.data;
};

// Функция для получения узлов конкретного проекта
export const fetchNodes = async (projectId) => {
  const response = await api.get(`/nodes/?project=${projectId}`);
  return response.data; // Возвращает GeoJSON FeatureCollection
};

// Функция для получения труб конкретного проекта
export const fetchPipes = async (projectId) => {
  const response = await api.get(`/pipes/?project=${projectId}`);
  return response.data;
};

// --- ПРОЕКТЫ ---

// Получить список всех проектов
export const fetchProjects = async () => {
  const response = await api.get("/projects/");
  return response.data;
};

// --- УЗЛЫ ---

// Создание узла (POST)
export const createNode = async (nodeData) => {
  const response = await api.post("/nodes/", nodeData);
  return response.data;
};

// Обновление узла (PATCH) - например, при перетаскивании
export const updateNode = async (id, data) => {
  const response = await api.patch(`/nodes/${id}/`, data);
  return response.data;
};

// Удаление узла (DELETE)
export const deleteNode = async (id) => {
  await api.delete(`/nodes/${id}/`);
  return id; // Возвращаем ID удаленного, чтобы убрать из Redux
};

// --- ТРУБЫ ---

// Создание трубы (POST)
export const createPipe = async (pipeData) => {
  const response = await api.post("/pipes/", pipeData);
  return response.data;
};

// Обновить трубу (PATCH)
export const updatePipe = async (id, data) => {
  const response = await api.patch(`/pipes/${id}/`, data);
  return response.data;
};

// Удаление трубы
export const deletePipe = async (id) => {
  await api.delete(`/pipes/${id}/`);
  return id;
};

// Запуск гидравлического расчета
export const calculateNetwork = async (projectId) => {
  // Отправляем POST запрос на /api/projects/{id}/calculate/
  const response = await api.post(`/projects/${projectId}/calculate/`);

  // Бэкенд возвращает структуру:
  // { status: "success", data: { nodes: FeatureCollection, pipes: FeatureCollection } }
  return response.data;
};

export default api;
