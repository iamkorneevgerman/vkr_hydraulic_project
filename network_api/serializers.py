# network_api/serializers.py

from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Project, Node, Pipe

# --- Сериализатор для Проекта ---
# Проекты не имеют геометрии, поэтому используем обычный ModelSerializer
class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__' # Включаем все поля (id, name, description...)

# --- Сериализатор для Узла ---
# Узлы имеют геометрию, используем GeoFeatureModelSerializer.
# Он автоматически сформирует структуру GeoJSON: { "type": "Feature", "geometry": { ... }, "properties": { ... } }
class NodeSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Node
        geo_field = "geometry" # Указываем, в каком поле хранится геометрия
        fields = '__all__'

# --- Сериализатор для Трубы ---
class PipeSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Pipe
        geo_field = "geometry"
        fields = '__all__'