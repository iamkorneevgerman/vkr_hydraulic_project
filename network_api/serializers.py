from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from django.contrib.auth.models import User  # ← ДОБАВИТЬ ЭТУ СТРОКУ
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

# === НОВЫЙ СЕРИАЛИЗАТОР ===
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4)

    class Meta:
        model = User
        fields = ('username', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user