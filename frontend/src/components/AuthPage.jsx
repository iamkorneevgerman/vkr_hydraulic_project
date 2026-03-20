// src/components/AuthPage.jsx
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { loginUser, registerUser } from "../services/api";
import { loginSuccess } from "../store/authSlice";
import { Droplets } from "lucide-react";
import styles from "./AuthPage.module.css";

const AuthPage = () => {
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (isLogin) {
        const data = await loginUser(username, password);
        dispatch(loginSuccess({ access: data.access, username }));
      } else {
        await registerUser(username, password);
        setSuccess("Регистрация успешна! Выполните вход.");
        setIsLogin(true);
        setPassword("");
      }
    } catch (err) {
      setError(
        isLogin
          ? "Неверный логин или пароль"
          : "Ошибка регистрации. Возможно, логин занят.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setSuccess("");
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <div className={styles.logoBox}>
            <Droplets size={32} />
          </div>
          <h2 className={styles.title}>
            {isLogin ? "Вход в систему" : "Регистрация"}
          </h2>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}
        {success && <div className={styles.successMessage}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder="Логин пользователя"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              placeholder="Пароль"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            {isLoading ? "Обработка..." : isLogin ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div className={styles.toggleText}>
          {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <span className={styles.toggleLink} onClick={toggleMode}>
            {isLogin ? "Зарегистрироваться" : "Войти"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
