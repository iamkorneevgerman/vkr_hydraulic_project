
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchNodes,
  fetchPipes,
  createNode,
  updateNode as apiUpdateNode,
  createPipe,
  updatePipe as apiUpdatePipe,
  calculateNetwork as apiCalculateNetwork,
} from "../services/api";

// 1. Загрузка всей сети (GET)
export const loadNetwork = createAsyncThunk(
  "network/loadNetwork",
  async (projectId) => {
    const [nodesData, pipesData] = await Promise.all([
      fetchNodes(projectId),
      fetchPipes(projectId),
    ]);
    return { nodes: nodesData, pipes: pipesData };
  }
);

// 2. Добавить узел (POST)
export const addNode = createAsyncThunk("network/addNode", async (nodeData) => {
  const newNode = await createNode(nodeData);
  return newNode;
});

// 3. Переместить узел (PATCH geometry)
export const moveNode = createAsyncThunk(
  "network/moveNode",
  async ({ id, lat, lng }) => {
    const geometry = { type: "Point", coordinates: [lng, lat] };
    const updatedNode = await apiUpdateNode(id, { geometry });
    return updatedNode;
  }
);

// 4. Добавить трубу (POST)
export const addPipe = createAsyncThunk("network/addPipe", async (pipeData) => {
  const newPipe = await createPipe(pipeData);
  return newPipe;
});

// 5. Обновить параметры трубы (PATCH)
export const updatePipe = createAsyncThunk(
  "network/updatePipe",
  async ({ id, data }) => {
    const updatedPipe = await apiUpdatePipe(id, data);
    return updatedPipe;
  }
);

// 6. Обновить параметры узла (PATCH)
export const updateNode = createAsyncThunk(
  "network/updateNode",
  async ({ id, data }) => {
    const updatedNode = await apiUpdateNode(id, data);
    return updatedNode;
  }
);

// 7. ЗАПУСК РАСЧЕТА (POST)
export const runCalculation = createAsyncThunk(
  "network/runCalculation",
  async (projectId) => {
    const result = await apiCalculateNetwork(projectId);
    return result; // Возвращаем весь ответ сервера { status:..., data: { nodes:..., pipes:... } }
  }
);

// === SLICE ===
const networkSlice = createSlice({
  name: "network",
  initialState: {
    nodes: [],
    pipes: [],
    status: "idle",
    currentProjectId: null,
    // Статусы для отдельных операций
    calculationStatus: "idle", // 'idle' | 'loading' | 'success' | 'error'
    updatePipeStatus: "idle",
    updateNodeStatus: "idle",

    lastError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // --- Load Network ---
      .addCase(loadNetwork.pending, (state) => {
        state.status = "loading";
      })
      .addCase(loadNetwork.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentProjectId = action.meta.arg;
        state.nodes = action.payload.nodes.features || [];
        state.pipes = action.payload.pipes.features || [];
      })
      .addCase(loadNetwork.rejected, (state) => {
        state.status = "failed";
      })

      // --- Add Node ---
      .addCase(addNode.fulfilled, (state, action) => {
        state.nodes.push(action.payload);
      })

      // --- Move Node ---
      .addCase(moveNode.fulfilled, (state, action) => {
        const index = state.nodes.findIndex((n) => n.id === action.payload.id);
        if (index !== -1) state.nodes[index] = action.payload;
      })

      // --- Add Pipe ---
      .addCase(addPipe.fulfilled, (state, action) => {
        state.pipes.push(action.payload);
      })

      // --- Update Pipe (Параметры) ---
      .addCase(updatePipe.pending, (state) => {
        state.updatePipeStatus = "loading";
      })
      .addCase(updatePipe.fulfilled, (state, action) => {
        state.updatePipeStatus = "succeeded";
        const index = state.pipes.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) state.pipes[index] = action.payload;
      })
      .addCase(updatePipe.rejected, (state, action) => {
        state.updatePipeStatus = "failed";
        state.lastError = action.error.message;
      })

      // --- Update Node (Параметры) ---
      .addCase(updateNode.pending, (state) => {
        state.updateNodeStatus = "loading";
      })
      .addCase(updateNode.fulfilled, (state, action) => {
        state.updateNodeStatus = "succeeded";
        const index = state.nodes.findIndex((n) => n.id === action.payload.id);
        if (index !== -1) state.nodes[index] = action.payload;
      })
      .addCase(updateNode.rejected, (state, action) => {
        state.updateNodeStatus = "failed";
        state.lastError = action.error.message;
      })

      // --- RUN CALCULATION ---
      .addCase(runCalculation.pending, (state) => {
        state.calculationStatus = "loading";
        state.lastError = null;
      })
      .addCase(runCalculation.fulfilled, (state, action) => {
        state.calculationStatus = "success";

        // 1. Извлекаем данные из ответа
        const incomingNodes = action.payload.data.nodes;
        const incomingPipes = action.payload.data.pipes;

        // 2. Безопасная проверка: это FeatureCollection или уже массив?
        // Это исправит проблему с исчезающими трубами

        // Обработка УЗЛОВ
        if (incomingNodes && incomingNodes.features) {
          state.nodes = incomingNodes.features;
        } else if (Array.isArray(incomingNodes)) {
          state.nodes = incomingNodes;
        } else {
          console.warn("Непонятный формат узлов от сервера", incomingNodes);
          state.nodes = [];
        }

        // Обработка ТРУБ
        if (incomingPipes && incomingPipes.features) {
          state.pipes = incomingPipes.features;
        } else if (Array.isArray(incomingPipes)) {
          state.pipes = incomingPipes;
        } else {
          console.warn("Непонятный формат труб от сервера", incomingPipes);
          state.pipes = [];
        }

        alert(`Расчет выполнен успешно! Обновлено труб: ${state.pipes.length}`);
      })
      .addCase(runCalculation.rejected, (state, action) => {
        state.calculationStatus = "error";
        state.lastError = action.error.message;
        alert(`Ошибка расчета: ${action.error.message}`);
      });
  },
});

export default networkSlice.reducer;
