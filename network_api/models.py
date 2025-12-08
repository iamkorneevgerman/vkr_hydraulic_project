# network_api/models.py
from django.contrib.gis.db import models

# --- Модель 1: Проект/Схема Сети (Project) ---
# Это основная сущность, которая объединяет все элементы одной гидравлической сети.
# Каждый узел и участок будут привязаны к какому-либо проекту.
class Project(models.Model):
    name = models.CharField(
        max_length=255,
        verbose_name="Название проекта"
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name="Описание"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата создания"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Дата обновления"
    )

    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ['-created_at']

    def __str__(self):
        return self.name


# --- Модель 2: Узел (Node) ---
# Представляет собой точечный объект в сети: потребитель, источник, перекресток труб и т.д.
class Node(models.Model):
    # Связь с проектом: при удалении проекта удаляются все его узлы
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='nodes',
        verbose_name="Проект"
    )
    name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Имя узла"
    )
    # Геометрическая отметка узла (высота над уровнем моря)
    elevation = models.FloatField(
        default=0,
        verbose_name="Отметка (высота)"
    )
    # Тип узла для определения его роли в расчете
    node_type = models.CharField(
        max_length=50,
        default='Junction', # 'Junction' (Соединение), 'Reservoir' (Резервуар), etc.
        verbose_name="Тип узла"
    )
    # Базовый расход для потребителей (отрицательное значение)
    base_demand = models.FloatField(
        default=0,
        verbose_name="Базовый расход"
    )
    # Заданный напор для источников (резервуаров)
    fixed_head = models.FloatField(
        blank=True,
        null=True,
        verbose_name="Заданный напор"
    )
    # ГЕОМЕТРИЯ: Поле PostGIS для хранения координат точки
    geometry = models.PointField(
        verbose_name="Геометрия (Точка)"
    )
    
    # --- Поля для результатов расчета (изначально пустые) ---
    calculated_pressure = models.FloatField(
        blank=True,
        null=True,
        verbose_name="Расчетное давление"
    )

    class Meta:
        verbose_name = "Узел"
        verbose_name_plural = "Узлы"

    def __str__(self):
        return f"Узел {self.id} (Проект: {self.project.name})"


# --- Модель 3: Участок / Труба (Pipe) ---
# Представляет собой линейный объект, соединяющий два узла.
class Pipe(models.Model):
    # Связь с проектом
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='pipes',
        verbose_name="Проект"
    )
    name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Имя участка"
    )
    # Связь с начальным узлом
    from_node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name='outgoing_pipes',
        verbose_name="Начальный узел"
    )
    # Связь с конечным узлом
    to_node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name='incoming_pipes',
        verbose_name="Конечный узел"
    )
    # Физические характеристики трубы
    length = models.FloatField(
        verbose_name="Длина"
    )
    diameter = models.FloatField(
        verbose_name="Диаметр"
    )
    roughness_coefficient = models.FloatField(
        verbose_name="Коэффициент шероховатости"
    )
    material = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Материал"
    )
    # ГЕОМЕТРИЯ: Поле PostGIS для хранения геометрии линии
    geometry = models.LineStringField(
        verbose_name="Геометрия (Линия)"
    )

    # --- Поля для результатов расчета (изначально пустые) ---
    calculated_flow_rate = models.FloatField(
        blank=True,
        null=True,
        verbose_name="Расчетный расход"
    )
    calculated_velocity = models.FloatField(
        blank=True,
        null=True,
        verbose_name="Расчетная скорость"
    )
    calculated_head_loss = models.FloatField(
        blank=True,
        null=True,
        verbose_name="Расчетные потери напора"
    )

    class Meta:
        verbose_name = "Участок (Труба)"
        verbose_name_plural = "Участки (Трубы)"

    def __str__(self):
        return f"Участок {self.id} (от Узла {self.from_node_id} к Узлу {self.to_node_id})"