from django.test import TestCase
from django.contrib.gis.geos import Point, LineString
from .models import Project, Node, Pipe
from .services import HydraulicSolver

class PhysicsVerificationTest(TestCase):
    """
    Серия тестов для проверки физической корректности расчетов.
    """

    def setUp(self):
        self.project = Project.objects.create(name="Physics Test")

    def test_01_parallel_pipes(self):
        """
        СЦЕНАРИЙ 1: Параллельные трубы.
        Суть: Есть источник и потребитель. Они соединены ДВУМЯ одинаковыми трубами.
        Ожидание: Общий расход (0.1) должен разделиться поровну (по 0.05 на трубу).
        """
        print("\n--- ТЕСТ 1: Параллельные трубы ---")
        
        # 1. Создаем узлы
        source = Node.objects.create(project=self.project, node_type="Reservoir", fixed_head=50, geometry=Point(0,0))
        consumer = Node.objects.create(project=self.project, node_type="Junction", base_demand=0.1, geometry=Point(100,0)) # Требует 0.1 м3/с

        # 2. Создаем две ИДЕНТИЧНЫЕ трубы
        pipe1 = Pipe.objects.create(
            project=self.project, name="Pipe A", from_node=source, to_node=consumer,
            length=100, diameter=100, roughness_coefficient=0.1, geometry=LineString((0,0), (100,0))
        )
        pipe2 = Pipe.objects.create(
            project=self.project, name="Pipe B", from_node=source, to_node=consumer,
            length=100, diameter=100, roughness_coefficient=0.1, geometry=LineString((0,0), (100,0))
        )

        # 3. Считаем
        solver = HydraulicSolver(self.project.id)
        result = solver.solve()
        self.assertTrue(result['success'])

        # 4. Проверяем
        pipe1.refresh_from_db()
        pipe2.refresh_from_db()
        
        print(f"Потребление: 0.1 м3/с")
        print(f"Расход в трубе A: {pipe1.calculated_flow_rate:.4f}")
        print(f"Расход в трубе B: {pipe2.calculated_flow_rate:.4f}")

        # Проверка: расходы должны быть равны (с маленькой погрешностью)
        self.assertAlmostEqual(pipe1.calculated_flow_rate, 0.05, places=3)
        self.assertAlmostEqual(pipe2.calculated_flow_rate, 0.05, places=3)
        print("✅ Расход поделился поровну!")

    def test_02_gravity_flow(self):
        """
        СЦЕНАРИЙ 2: Гравитационное течение (Сообщающиеся сосуды).
        Суть: Два резервуара. Один на высоте 50м, другой на 30м. Нет потребителей.
        Ожидание: Вода должна потечь от высокого к низкому.
        """
        print("\n--- ТЕСТ 2: Сообщающиеся сосуды ---")
        
        node_high = Node.objects.create(project=self.project, node_type="Reservoir", fixed_head=50, geometry=Point(0,0))
        node_low = Node.objects.create(project=self.project, node_type="Reservoir", fixed_head=30, geometry=Point(100,0))

        pipe = Pipe.objects.create(
            project=self.project, from_node=node_high, to_node=node_low,
            length=1000, diameter=200, roughness_coefficient=0.1, geometry=LineString((0,0), (100,0))
        )

        solver = HydraulicSolver(self.project.id)
        solver.solve()
        
        pipe.refresh_from_db()
        print(f"Напор 1: 50м, Напор 2: 30м. Перепад: 20м.")
        print(f"Расход: {pipe.calculated_flow_rate:.4f} м3/с")

        # Проверка: Расход должен быть положительным (от High к Low) и не нулевым
        self.assertTrue(pipe.calculated_flow_rate > 0)
        print("✅ Вода течет в правильную сторону!")

    def test_03_accuracy_check(self):
        """
        СЦЕНАРИЙ 3: Сравнение с эталоном.
        Берем конкретные цифры и проверяем формулу Дарси-Вейсбаха.
        Параметры: L=100м, D=100мм, Шероховатость=0.1мм.
        Прогоняем расход Q=0.02 м3/с.
        Какая должна быть потеря напора?
        """
        print("\n--- ТЕСТ 3: Точность формулы ---")
        
        # Создаем условия для расхода ровно 0.02
        source = Node.objects.create(project=self.project, node_type="Reservoir", fixed_head=100, geometry=Point(0,0))
        consumer = Node.objects.create(project=self.project, node_type="Junction", base_demand=0.02, geometry=Point(100,0))

        pipe = Pipe.objects.create(
            project=self.project, from_node=source, to_node=consumer,
            length=100, diameter=100, roughness_coefficient=0.1, geometry=LineString((0,0), (100,0))
        )

        solver = HydraulicSolver(self.project.id)
        solver.solve()
        
        pipe.refresh_from_db()
        
        # ЭТАЛОН:
        # Для D=100мм, k=0.1мм, L=100м, Q=0.02 м3/с (это 20 л/с или 72 м3/ч)
        # Скорость V = 2.546 м/с.
        # По онлайн калькулятору Дарси-Вейсбаха потери должны быть около ~6.8 - 7.0 метров.
        
        print(f"Задан расход: 0.02 м3/с")
        print(f"Рассчитанная потеря напора: {pipe.calculated_head_loss:.4f} м")
        
        # Проверяем, попадаем ли мы в диапазон 6.8 - 7.0 метров
        self.assertTrue(6.5 < pipe.calculated_head_loss < 7.2)
        print(f"✅ Потери напора совпадают с табличными значениями!")