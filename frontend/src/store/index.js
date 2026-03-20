import { configureStore } from "@reduxjs/toolkit";
import networkReducer from "./networkSlice";
import uiReducer from "./uiSlice";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    network: networkReducer,
    ui: uiReducer,
    auth: authReducer,
  },
});
