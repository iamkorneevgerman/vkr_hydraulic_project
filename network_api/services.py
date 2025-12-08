import numpy as np
from scipy.optimize import fsolve
from django.db import transaction
from .models import Node, Pipe
import traceback  # <--- Добавили для вывода полных ошибок

class HydraulicSolver:
    def __init__(self, project_id):
        self.project_id = project_id
        self.nodes = []
        self.pipes = []
        self.node_id_to_index = {}
        self.index_to_node_id = {}

        # Физические константы
        self.G = 9.81
        self.VISCOSITY = 1.004e-6

        # Численные настройки
        self.pipe_q_tol = 1e-9
        self.pipe_q_maxiter = 100
        self.equation_tol = 1e-6
        self.maxfev = 5000

    # -------------------------
    # Загрузка и валидация данных
    # -------------------------
    def load_data(self):
        print(f"--- [DEBUG] Загрузка данных для проекта {self.project_id} ---")
        self.nodes = list(Node.objects.filter(project_id=self.project_id))
        self.pipes = list(Pipe.objects.filter(project_id=self.project_id))

        print(f"--- [DEBUG] Найдено узлов: {len(self.nodes)}, труб: {len(self.pipes)}")

        if not self.nodes:
            raise ValueError("В проекте нет узлов для расчёта")

        for idx, node in enumerate(self.nodes):
            self.node_id_to_index[node.id] = idx
            self.index_to_node_id[idx] = node.id

        for pipe in self.pipes:
            if pipe.from_node_id not in self.node_id_to_index or pipe.to_node_id not in self.node_id_to_index:
                raise ValueError(f"Труба {pipe.id} ссылается на несуществующий узел")

        fixed_nodes = [n for n in self.nodes if getattr(n, 'fixed_head', None) is not None]
        if not fixed_nodes:
            raise ValueError("Сеть должна содержать хотя бы один узел с фиксированным напором")

    # -------------------------
    # Коэффициент трения
    # -------------------------
    def swamee_jain_f(self, D, eps, v):
        if D <= 0: return 0.02
        if v <= 0: return 0.02
        Re = abs(v) * D / self.VISCOSITY
        if Re < 2300: return 64.0 / Re
        rel_rough = eps / D
        a = rel_rough / 3.7
        b = 5.74 / (Re ** 0.9)
        denom = np.log10(a + b)
        if denom == 0: denom = 1e-12
        f = 0.25 / (denom ** 2)
        return f

    # -----------------------------------
    # Итерационный расчёт расхода Q
    # -----------------------------------
    def flow_for_headloss(self, abs_delta_h, pipe):
        if abs_delta_h <= 0: return 0.0

        L = float(pipe.length)
        D_m = float(pipe.diameter) / 1000.0
        eps_m = float(pipe.roughness_coefficient) / 1000.0

        if L <= 0 or D_m <= 0: return 0.0

        area = np.pi * (D_m ** 2) / 4.0

        rel_rough = eps_m / D_m if D_m > 0 else 0.0
        if rel_rough > 0:
            try:
                f = 0.25 / (np.log10(rel_rough / 3.7) ** 2)
            except ValueError:
                f = 0.02
            f = float(np.clip(f, 0.008, 0.1))
        else:
            f = 0.02

        R = (8.0 * f * L) / (self.G * (np.pi ** 2) * (D_m ** 5))
        if R <= 0: return 0.0
        Q = np.sqrt(abs_delta_h / R)

        for _ in range(self.pipe_q_maxiter):
            if Q <= 0: return 0.0
            v = Q / area
            f_new = self.swamee_jain_f(D_m, eps_m, v)
            if f_new <= 1e-9: f_new = 1e-9
            R_new = (8.0 * f_new * L) / (self.G * (np.pi ** 2) * (D_m ** 5))
            if R_new <= 0: return 0.0
            Q_new = np.sqrt(abs_delta_h / R_new)
            if abs(Q_new - Q) < self.pipe_q_tol:
                Q = Q_new
                break
            Q = Q_new
        return Q

    # -------------------------
    # Система уравнений
    # -------------------------
    def equations(self, heads_unknown):
        n = len(self.nodes)
        residuals = np.zeros(n)

        for i, node in enumerate(self.nodes):
            node_fixed_head = getattr(node, 'fixed_head', None)
            if node_fixed_head is not None:
                residuals[i] = heads_unknown[i] - node_fixed_head
                continue

            net_inflow = 0.0
            related = [p for p in self.pipes if p.from_node_id == node.id or p.to_node_id == node.id]

            for pipe in related:
                idx_from = self.node_id_to_index[pipe.from_node_id]
                idx_to = self.node_id_to_index[pipe.to_node_id]
                h_from = heads_unknown[idx_from]
                h_to = heads_unknown[idx_to]
                delta_h = h_from - h_to
                abs_dh = abs(delta_h)
                q_mag = self.flow_for_headloss(abs_dh, pipe)
                q_signed = q_mag if delta_h >= 0 else -q_mag

                if node.id == pipe.to_node_id:
                    net_inflow += q_signed
                elif node.id == pipe.from_node_id:
                    net_inflow -= q_signed

            demand = getattr(node, 'base_demand', 0.0) or 0.0
            residuals[i] = net_inflow - demand

        return residuals

    # -------------------------
    # ЗАПУСК (С ЛОГАМИ)
    # -------------------------
    def solve(self):
        print("\n=== START SOLVER ===")
        try:
            self.load_data()
        except Exception as e:
            print(f"[ERROR] Ошибка загрузки: {e}")
            return {"success": False, "message": str(e)}

        n = len(self.nodes)
        initial_heads = np.zeros(n)
        for i, node in enumerate(self.nodes):
            if getattr(node, 'fixed_head', None) is not None:
                initial_heads[i] = node.fixed_head
            else:
                initial_heads[i] = (getattr(node, 'elevation', 0.0) or 0.0) + 20.0

        print(f"--- [DEBUG] Начальные напоры: {initial_heads}")

        solution_heads, info, ier, msg = fsolve(
            self.equations,
            initial_heads,
            full_output=True,
            xtol=self.equation_tol,
            maxfev=self.maxfev
        )

        print(f"--- [DEBUG] Результат fsolve: ier={ier}, msg={msg}")
        print(f"--- [DEBUG] Найденные напоры: {solution_heads}")

        if ier != 1:
            return {"success": False, "message": f"Расчет не сошелся: {msg}"}

        try:
            self.save_results(solution_heads)
            print("=== SUCCESS: Результаты сохранены ===")
            return {"success": True, "message": "Расчет выполнен успешно"}
        except Exception as e:
            print("!!! EXCEPTION IN SAVE !!!")
            traceback.print_exc() # Выводит полный текст ошибки в консоль
            return {"success": False, "message": f"Ошибка сохранения: {e}"}

    def save_results(self, heads):
        print("--- [DEBUG] Сохранение результатов в БД... ---")
        with transaction.atomic():
            for i, node in enumerate(self.nodes):
                head = float(heads[i])
                elevation = float(getattr(node, 'elevation', 0.0) or 0.0)
                pressure = head - elevation
                pressure = max(pressure, -100.0)
                pressure = min(pressure, 1000.0)
                
                # ЛОГ ДЛЯ УЗЛА
                print(f" Node {node.id}: P={pressure:.2f}")

                node.calculated_pressure = pressure
                node.save(update_fields=['calculated_pressure'])

            for pipe in self.pipes:
                idx_from = self.node_id_to_index[pipe.from_node_id]
                idx_to = self.node_id_to_index[pipe.to_node_id]
                h_from = float(heads[idx_from])
                h_to = float(heads[idx_to])
                delta_h = h_from - h_to
                head_loss = abs(delta_h)

                q_mag = self.flow_for_headloss(head_loss, pipe)
                q_signed = q_mag if delta_h >= 0 else -q_mag

                D_m = float(pipe.diameter) / 1000.0
                area = np.pi * (D_m ** 2) / 4.0 if D_m > 0 else 1.0
                velocity = q_signed / area if area > 0 else 0.0
                
                # ЛОГ ДЛЯ ТРУБЫ
                print(f" Pipe {pipe.id}: Q={q_signed:.4f}, V={velocity:.2f}")

                pipe.calculated_flow_rate = q_signed
                pipe.calculated_velocity = velocity
                pipe.calculated_head_loss = head_loss
                pipe.save(update_fields=['calculated_flow_rate', 'calculated_velocity', 'calculated_head_loss'])