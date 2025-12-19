import numpy as np
from scipy.optimize import fsolve
from django.db import transaction
from .models import Node, Pipe
import traceback

class HydraulicSolver:
    def __init__(self, project_id):
        self.project_id = project_id
        self.nodes = []
        self.pipes = []
        self.node_id_to_index = {}
        self.index_to_node_id = {}

        # Физические константы
        self.G = 9.81  # Ускорение свободного падения, м/с^2
        self.VISCOSITY = 1.004e-6  # Кинематическая вязкость воды (20°C), м^2/с

        # Численные настройки
        self.pipe_q_tol = 1e-9    # Точность подбора расхода в трубе
        self.pipe_q_maxiter = 100 # Макс итераций для подбора расхода
        self.equation_tol = 1e-6  # Точность решения системы уравнений
        self.maxfev = 5000        # Макс итераций fsolve

    # ------------------------------------------------------------------
    # 1. ЗАГРУЗКА ДАННЫХ
    # ------------------------------------------------------------------
    def load_data(self):
        print(f"--- [DEBUG] Загрузка данных для проекта {self.project_id} ---")
        self.nodes = list(Node.objects.filter(project_id=self.project_id))
        self.pipes = list(Pipe.objects.filter(project_id=self.project_id))

        print(f"--- [DEBUG] Найдено узлов: {len(self.nodes)}, труб: {len(self.pipes)}")

        if not self.nodes:
            raise ValueError("В проекте нет узлов для расчёта")

        # Индексация для матриц
        for idx, node in enumerate(self.nodes):
            self.node_id_to_index[node.id] = idx
            self.index_to_node_id[idx] = node.id

        # Проверка целостности графа
        for pipe in self.pipes:
            if pipe.from_node_id not in self.node_id_to_index or pipe.to_node_id not in self.node_id_to_index:
                raise ValueError(f"Труба {pipe.id} ссылается на несуществующий узел")

        # Проверка источников
        fixed_nodes = [n for n in self.nodes if getattr(n, 'fixed_head', None) is not None]
        if not fixed_nodes:
            raise ValueError("Сеть должна содержать хотя бы один узел с фиксированным напором (Источник/Резервуар)")

    # ------------------------------------------------------------------
    # 2. ГИДРАВЛИЧЕСКИЕ ФОРМУЛЫ
    # ------------------------------------------------------------------
    
    def swamee_jain_f(self, D, eps, v):
        """
        Расчет коэффициента трения Дарси-Вейсбаха (f).
        Используется формула Свами-Джейна для турбулентного режима.
        
        Параметры:
        D: диаметр (метры)
        eps: шероховатость (метры)
        v: скорость (м/с)
        """
        if D <= 0: return 0.02
        if v <= 0: return 0.02 # Защита от деления на ноль
        
        Re = abs(v) * D / self.VISCOSITY
        
        # Ламинарный режим (Re < 2300)
        if Re < 2300: 
            if Re == 0: return 0.02
            return 64.0 / Re
            
        # Турбулентный и переходный режим (Swamee-Jain)
        rel_rough = eps / D
        
        # Защита от логарифма нуля или отрицательного числа
        a = rel_rough / 3.7
        b = 5.74 / (Re ** 0.9)
        
        denom = np.log10(a + b)
        if denom == 0: denom = 1e-12
        
        f = 0.25 / (denom ** 2)
        return f

    def flow_for_headloss(self, abs_delta_h, pipe):
        """
        Вычисляет РАСХОД (Q, м3/с) по известной потере напора (abs_delta_h).
        Метод итерационный, так как коэффициент трения (f) зависит от скорости (а значит и от Q).
        """
        if abs_delta_h <= 0: return 0.0

        # Входные данные: L (м), D (мм -> м), Eps (мм -> м)
        L = float(pipe.length)
        D_m = float(pipe.diameter) / 1000.0
        eps_m = float(pipe.roughness_coefficient) / 1000.0

        if L <= 0 or D_m <= 0: return 0.0

        area = np.pi * (D_m ** 2) / 4.0

        # --- [ИСПРАВЛЕНИЕ 2.2] Улучшенное начальное приближение ---
        # Предполагаем типичную скорость для водопровода v = 1.0 м/с для старта
        v_guess = 1.0 
        f = self.swamee_jain_f(D_m, eps_m, v_guess)

        # Вычисляем первое приближение Q
        # Формула: h = f * (L/D) * (v^2 / 2g)  =>  h = (8 * f * L * Q^2) / (g * pi^2 * D^5)
        # Отсюда R = (8 * f * L) / (g * pi^2 * D^5)
        
        denom_const = self.G * (np.pi ** 2) * (D_m ** 5)
        R = (8.0 * f * L) / denom_const
        
        if R <= 0: return 0.0
        Q = np.sqrt(abs_delta_h / R)

        # --- Итерационное уточнение Q ---
        # Мы нашли Q, теперь уточним Re и f, и снова найдем Q
        for _ in range(self.pipe_q_maxiter):
            if Q <= 0: return 0.0
            
            v = Q / area
            f_new = self.swamee_jain_f(D_m, eps_m, v)
            
            # Ограничиваем f снизу, чтобы не улететь в бесконечность
            if f_new <= 1e-5: f_new = 1e-5
            
            R_new = (8.0 * f_new * L) / denom_const
            
            if R_new <= 0: return 0.0
            
            Q_new = np.sqrt(abs_delta_h / R_new)
            
            # Проверка сходимости
            if abs(Q_new - Q) < self.pipe_q_tol:
                Q = Q_new
                break
            Q = Q_new
            
        return Q

    # ------------------------------------------------------------------
    # 3. СИСТЕМА УРАВНЕНИЙ (БАЛАНСЫ)
    # ------------------------------------------------------------------
    def equations(self, heads_unknown):
        n = len(self.nodes)
        residuals = np.zeros(n)

        for i, node in enumerate(self.nodes):
            # Если узел с фиксированным напором (Источник)
            node_fixed_head = getattr(node, 'fixed_head', None)
            if node_fixed_head is not None:
                # Уравнение: H_calc - H_fixed = 0
                residuals[i] = heads_unknown[i] - node_fixed_head
                continue

            # Для обычного узла: Сумма притоков - Сумма оттоков - Потребление = 0
            net_inflow = 0.0
            
            # Ищем смежные трубы (оптимизация: в реальном проекте лучше предвычислить список смежности)
            related = [p for p in self.pipes if p.from_node_id == node.id or p.to_node_id == node.id]

            for pipe in related:
                idx_from = self.node_id_to_index[pipe.from_node_id]
                idx_to = self.node_id_to_index[pipe.to_node_id]
                
                h_from = heads_unknown[idx_from]
                h_to = heads_unknown[idx_to]
                
                delta_h = h_from - h_to # Если > 0, течет от from к to
                abs_dh = abs(delta_h)
                
                # Вычисляем модуль расхода
                q_mag = self.flow_for_headloss(abs_dh, pipe)
                
                # Придаем знак: (+) если течет от from к to
                q_signed = q_mag if delta_h >= 0 else -q_mag

                # Баланс для текущего узла:
                if node.id == pipe.to_node_id:
                    # Мы "to", значит поток q_signed втекает к нам (+)
                    net_inflow += q_signed
                elif node.id == pipe.from_node_id:
                    # Мы "from", значит поток q_signed утекает от нас (-)
                    net_inflow -= q_signed

            demand = getattr(node, 'base_demand', 0.0) or 0.0
            # Уравнение неразрывности (Кирхгофа)
            residuals[i] = net_inflow - demand

        return residuals

    # ------------------------------------------------------------------
    # 4. ЗАПУСК И СОХРАНЕНИЕ
    # ------------------------------------------------------------------
    def solve(self):
        print("\n=== START SOLVER (IMPROVED) ===")
        try:
            self.load_data()
        except Exception as e:
            print(f"[ERROR] Ошибка загрузки: {e}")
            return {"success": False, "message": str(e)}

        n = len(self.nodes)
        initial_heads = np.zeros(n)
        
        # --- [ИСПРАВЛЕНИЕ 3.1] Умное начальное приближение ---
        # 1. Найдем средний напор источников
        sources = [n for n in self.nodes if getattr(n, 'fixed_head', None) is not None]
        avg_source_head = sum([s.fixed_head for s in sources]) / len(sources) if sources else 20.0
        
        print(f"--- [DEBUG] Средний напор источников: {avg_source_head:.2f} м")

        for i, node in enumerate(self.nodes):
            if getattr(node, 'fixed_head', None) is not None:
                initial_heads[i] = node.fixed_head
            else:
                # Всем остальным ставим напор источников (вода заполнила систему)
                # Это лучше, чем "земля + 20м", так как ближе к финальному распределению давления
                initial_heads[i] = avg_source_head

        # print(f"--- [DEBUG] Начальные напоры: {initial_heads}")

        # Запуск решателя
        solution_heads, info, ier, msg = fsolve(
            self.equations,
            initial_heads,
            full_output=True,
            xtol=self.equation_tol,
            maxfev=self.maxfev
        )

        print(f"--- [DEBUG] Результат fsolve: ier={ier}, msg={msg}")
        # print(f"--- [DEBUG] Найденные напоры: {solution_heads}")

        if ier != 1:
            return {"success": False, "message": f"Расчет не сошелся: {msg}"}

        try:
            self.save_results(solution_heads)
            print("=== SUCCESS: Результаты сохранены ===")
            return {"success": True, "message": "Расчет выполнен успешно"}
        except Exception as e:
            print("!!! EXCEPTION IN SAVE !!!")
            traceback.print_exc()
            return {"success": False, "message": f"Ошибка сохранения: {e}"}

    def save_results(self, heads):
        print("--- [DEBUG] Сохранение результатов в БД... ---")
        with transaction.atomic():
            # Сохраняем Узлы
            for i, node in enumerate(self.nodes):
                head = float(heads[i])
                elevation = float(getattr(node, 'elevation', 0.0) or 0.0)
                pressure = head - elevation
                
                # Ограничиваем неадекватные значения для БД
                pressure = max(pressure, -100.0)
                pressure = min(pressure, 2000.0)
                
                node.calculated_pressure = pressure
                node.save(update_fields=['calculated_pressure'])

            # Сохраняем Трубы
            for pipe in self.pipes:
                idx_from = self.node_id_to_index[pipe.from_node_id]
                idx_to = self.node_id_to_index[pipe.to_node_id]
                h_from = float(heads[idx_from])
                h_to = float(heads[idx_to])
                
                delta_h = h_from - h_to
                head_loss = abs(delta_h)

                # Пересчитываем финальные параметры потока
                q_mag = self.flow_for_headloss(head_loss, pipe)
                q_signed = q_mag if delta_h >= 0 else -q_mag

                D_m = float(pipe.diameter) / 1000.0
                area = np.pi * (D_m ** 2) / 4.0 if D_m > 0 else 1.0
                velocity = q_signed / area if area > 0 else 0.0
                
                print(f" Pipe {pipe.id}: Q={q_signed:.4f} m3/s, V={velocity:.2f} m/s, Loss={head_loss:.2f} m")

                pipe.calculated_flow_rate = q_signed
                pipe.calculated_velocity = velocity
                pipe.calculated_head_loss = head_loss
                pipe.save(update_fields=['calculated_flow_rate', 'calculated_velocity', 'calculated_head_loss'])