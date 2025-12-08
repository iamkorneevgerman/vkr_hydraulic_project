import { configureStore } from "@reduxjs/toolkit";
import networkReducer from "./networkSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    network: networkReducer,
    ui: uiReducer,
  },
});
