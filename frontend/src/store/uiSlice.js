// src/store/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

export const MODES = {
  VIEW: "view",
  ADD_NODE: "add_node",
  ADD_PIPE: "add_pipe",
  DELETE: "delete",
  EDIT: "edit",
};

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    mode: MODES.VIEW,
    selectedNodeId: null,
    selectedPipeId: null,
    editingElement: null,
    notification: null,
    lastClickCoords: null,
    drawingMode: false,
    focusTarget: null,
  },
  reducers: {
    setMode: (state, action) => {
      state.mode = action.payload;
      state.selectedNodeId = null;
      state.selectedPipeId = null;
      state.editingElement = null;
      state.drawingMode = false;

      // Автоматические уведомления
      switch (action.payload) {
        case MODES.VIEW:
          state.notification = "Режим просмотра";
          break;
        case MODES.ADD_NODE:
          state.notification = "Режим добавления узла: кликните на карте";
          break;
        case MODES.ADD_PIPE:
          state.notification =
            "Режим добавления трубы: выберите начальный узел";
          break;
        case MODES.DELETE:
          state.notification =
            "Режим удаления: кликните на элемент для удаления";
          break;
        default:
          state.notification = null;
      }
    },

    selectNode: (state, action) => {
      state.selectedNodeId = action.payload;

      // Логика для режима добавления трубы
      if (state.mode === MODES.ADD_PIPE) {
        if (!state.drawingMode) {
          state.drawingMode = true;
          state.notification = "Выберите конечный узел для трубы";
        } else {
          state.notification = null;
        }
      }
    },

    selectPipe: (state, action) => {
      state.selectedPipeId = action.payload;
    },

    resetSelection: (state) => {
      state.selectedNodeId = null;
      state.selectedPipeId = null;
      state.drawingMode = false;
      state.notification = null;
    },

    setEditingElement: (state, action) => {
      state.editingElement = action.payload;
      state.notification = null;
    },

    closeSidebar: (state) => {
      state.editingElement = null;
    },

    // Редьюсеры для уведомлений
    setNotification: (state, action) => {
      state.notification = action.payload;
    },

    clearNotification: (state) => {
      state.notification = null;
    },

    setLastClickCoords: (state, action) => {
      state.lastClickCoords = action.payload;
    },

    setFocusTarget: (state, action) => {
      state.focusTarget = action.payload;
    },
  },
});

// Экспортируем ВСЕ actions
export const {
  setMode,
  selectNode,
  selectPipe,
  resetSelection,
  setEditingElement,
  closeSidebar,
  setNotification,
  clearNotification,
  setLastClickCoords,
  setFocusTarget,
} = uiSlice.actions;

export default uiSlice.reducer;
