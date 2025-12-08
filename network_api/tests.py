from django.test import TestCase
from django.contrib.gis.geos import Point, LineString
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from .models import Project, Node, Pipe
from .services import HydraulicSolver

class HydraulicSolverTestCase(TestCase):
    """
    Тесты для проверки математического ядра (HydraulicSolver).
    """

    def setUp(self):
        """
        Этот метод запускается автоматически ПЕРЕД каждым тестом.
        Здесь мы создаем тестовые данные.
        """
        # 1. Создаем проект
        self.project = Project.objects.create(name="Test Physics Project")

        # 2. Создаем Источник (Напор 50м)
        self.source = Node.objects.create(
            project=self.project,
            name="Source",
            node_type="Reservoir",
            fixed_head=50.0,
            elevation=0.0,
            geometry=Point(0, 0)
        )

        # 3. Создаем Потребителя (Требует 0.02 м3/с)
        self.consumer = Node.objects.create(
            project=self.project,
            name="Consumer",
            node_type="Junction",
            base_demand=0.02, # м3/с
            elevation=0.0,
            geometry=Point(100, 0)
        )

        # 4. Создаем Трубу между ними (Длина 100м, D=100мм, Шероховатость=0.1мм)
        self.pipe = Pipe.objects.create(
            project=self.project,
            name="Pipe 1",
            from_node=self.source,
            to_node=self.consumer,
            length=100.0,
            diameter=100.0, 
            roughness_coefficient=0.1,
            geometry=LineString((0, 0), (100, 0))
        )

    def test_solve_simple_network(self):
        """
        Проверка расчета простой сети: Источник -> Труба -> Потребитель.
        """
        solver = HydraulicSolver(self.project.id)
        result = solver.solve()

        # 1. Проверяем, что расчет вообще прошел успешно
        self.assertTrue(result['success'], f"Расчет упал с ошибкой: {result.get('message')}")

        # Обновляем объекты из БД, чтобы увидеть результаты
        self.source.refresh_from_db()
        self.consumer.refresh_from_db()
        self.pipe.refresh_from_db()

        # 2. Проверяем давление на источнике (должно остаться 50)
        self.assertAlmostEqual(self.source.calculated_pressure, 50.0, places=2)

        # 3. Проверяем давление у потребителя
        # Оно должно быть меньше 50 (из-за потерь), но больше 0.
        # В твоем ручном тесте было около 43. Проверим, что оно в разумных пределах.
        self.assertTrue(0 < self.consumer.calculated_pressure < 50.0)
        print(f"\n[TEST] Давление у потребителя: {self.consumer.calculated_pressure:.2f} м")

        # 4. Проверяем расход в трубе
        # Закон сохранения: Расход в трубе должен быть равен потреблению узла (0.02)
        # Учитываем направление потока (может быть + или -)
        self.assertAlmostEqual(abs(self.pipe.calculated_flow_rate), 0.02, places=5)
        print(f"[TEST] Расход в трубе: {self.pipe.calculated_flow_rate:.5f} м3/с")

        # 5. Проверяем скорость
        # V = Q / S. Если Q ~ 0.02, D=0.1m => S=0.00785 => V ~ 2.54 м/с
        self.assertTrue(2.0 < self.pipe.calculated_velocity < 3.0)


class ApiEndpointsTestCase(APITestCase):
    """
    Тесты для проверки доступности API (создание, чтение, запуск расчета).
    """

    def setUp(self):
        self.project = Project.objects.create(name="API Test Project")
        # URL для списка проектов: /api/projects/
        self.projects_url = reverse('project-list') 

    def test_create_project(self):
        """Тест создания проекта через API"""
        data = {'name': 'New API Project'}
        response = self.client.post(self.projects_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Project.objects.count(), 2) # 1 в setUp + 1 сейчас

    def test_calculate_endpoint(self):
        """Тест запуска расчета через API"""
        # Создаем минимальную сеть для расчета
        node = Node.objects.create(
            project=self.project, 
            node_type="Reservoir", fixed_head=50, elevation=0, 
            geometry=Point(0,0)
        )
        
        # Формируем URL: /api/projects/{id}/calculate/
        # 'project-calculate' - это имя маршрута, которое DRF создает автоматически для @action
        url = reverse('project-calculate', args=[self.project.id])
        
        response = self.client.post(url)
        
        # Ожидаем 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Проверяем структуру ответа
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('nodes', response.data['data'])
        self.assertIn('pipes', response.data['data'])